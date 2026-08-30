import type { Logger } from "pino";

import {
  createHttpApiError,
  createNetworkApiError,
  isRetryableFetchFailure,
  MeritApiError,
  RETRYABLE_HTTP_STATUSES,
} from "./api-error.js";
import {
  MERIT_CLIENT_USER_AGENT,
  type MeritAuthConfig,
  meritRequestTimeoutMsFromEnv,
  meritTimestampUtc,
  signMeritRequest,
} from "./auth.js";
import { logger as defaultLogger } from "./logger.js";

export { MeritApiError, RETRYABLE_HTTP_STATUSES } from "./api-error.js";

/** Static env config or a per-request resolver (SaaS multi-tenant injection). */
export type AuthConfigSource = MeritAuthConfig | (() => MeritAuthConfig);

export interface MeritClientOptions {
  logger?: Logger;
  /** Max pages `postAllPages` will fetch (first page + continuations); default 100; minimum 1. */
  maxPages?: number;
}

/** Continuation endpoint for paginated report responses (`HasMore` / `Id4More`). */
export const GET_MORE_DATA_PATH = "/api/v2/getmoredata";

const MAX_BACKOFF_MS = 8000;

function backoffDelayMs(attemptIndex: number, baseMs: number): number {
  const exponential = Math.min(baseMs * 2 ** attemptIndex, MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * Math.min(baseMs, 200));
  return Math.min(exponential + jitter, MAX_BACKOFF_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Parse `Retry-After` (seconds or HTTP-date). Returns delay ms, or null if unusable. */
export function parseRetryAfterMs(header: string | null, nowMs = Date.now()): number | null {
  if (header === null || header.trim() === "") {
    return null;
  }
  const trimmed = header.trim();
  const asSeconds = Number.parseInt(trimmed, 10);
  if (Number.isFinite(asSeconds) && String(asSeconds) === trimmed) {
    if (asSeconds < 0) {
      return null;
    }
    return Math.min(asSeconds * 1000, MAX_BACKOFF_MS);
  }
  const asDate = Date.parse(trimmed);
  if (!Number.isFinite(asDate)) {
    return null;
  }
  const delta = asDate - nowMs;
  if (delta <= 0) {
    return 0;
  }
  return Math.min(delta, MAX_BACKOFF_MS);
}

/**
 * Parses a Merit response body. Merit occasionally double-encodes JSON —
 * some v1 endpoints return a JSON *string* whose content is itself JSON —
 * and occasionally returns plain text even with a 200 status; both are
 * handled here rather than surfaced as parse errors.
 */
export function parseMeritResponseText(text: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  if (typeof parsed === "string") {
    const head = parsed.trimStart();
    if (head.startsWith("{") || head.startsWith("[")) {
      try {
        return JSON.parse(parsed) as unknown;
      } catch {
        return parsed;
      }
    }
  }
  return parsed;
}

/**
 * Splits a Merit response into pagination parts. Plain list endpoints return
 * bare arrays; paginated reports return an envelope object whose rows live in
 * an array-valued property next to `HasMore` / `Id4More`.
 */
export function splitPaginationEnvelope<T = unknown>(
  response: unknown,
): {
  items: T[];
  hasMore: boolean;
  id4More: string | undefined;
} {
  if (Array.isArray(response)) {
    return { items: response as T[], hasMore: false, id4More: undefined };
  }
  if (response !== null && typeof response === "object") {
    const record = response as Record<string, unknown>;
    const firstArray = Object.values(record).find((value) => Array.isArray(value));
    return {
      items: (firstArray ?? []) as T[],
      hasMore: record.HasMore === true,
      id4More:
        typeof record.Id4More === "string" && record.Id4More !== "" ? record.Id4More : undefined,
    };
  }
  throw new Error(
    `Expected a Merit array or pagination envelope, got ${response === null ? "null" : typeof response}`,
  );
}

export class MeritClient {
  private readonly resolveConfig: () => MeritAuthConfig;
  private readonly logger: Logger;
  private readonly maxPages: number;

  constructor(source: AuthConfigSource, options?: MeritClientOptions) {
    this.resolveConfig = typeof source === "function" ? source : () => source;
    this.logger = options?.logger ?? defaultLogger;
    this.maxPages = Math.max(1, options?.maxPages ?? 100);
  }

  getConfig(): MeritAuthConfig {
    return this.resolveConfig();
  }

  private logRequest(path: string, started: number, error?: unknown): void {
    const durationMs = Math.round(performance.now() - started);
    if (error === undefined) {
      this.logger.info(
        { component: "http", method: "POST", path, durationMs, outcome: "ok" },
        "merit request",
      );
      return;
    }
    if (error instanceof MeritApiError) {
      const outcome = error.kind === "network" ? "network_error" : "http_error";
      this.logger.info(
        {
          component: "http",
          method: "POST",
          path,
          requestUrl: error.url,
          durationMs,
          outcome,
          httpStatus: error.httpStatus,
        },
        "merit request",
      );
      return;
    }
    this.logger.info(
      { component: "http", method: "POST", path, durationMs, outcome: "unknown_error" },
      "merit request",
    );
  }

  /**
   * POST a JSON body to a full Merit path (`/api/v1/…` or `/api/v2/…`); the
   * client prefixes the configured base URL. Auth travels as `apiId`,
   * `timestamp`, and `signature` query params computed from the exact
   * serialized body. Every attempt — including 429/5xx/network retries —
   * generates a fresh timestamp and signature, as Merit's rate limiter
   * rejects reused ones.
   */
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const started = performance.now();
    // Sign the exact bytes sent on the wire; whitespace changes the HMAC.
    const rawBody = JSON.stringify(body ?? {});

    try {
      const config = this.resolveConfig();
      const maxRetries = Math.max(0, config.httpMaxRetries ?? 0);
      const retryBaseMs = Math.max(0, config.httpRetryBaseMs ?? 500);
      const timeoutMs = config.requestTimeoutMs ?? meritRequestTimeoutMsFromEnv();
      const maxAttempts = 1 + maxRetries;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isLastAttempt = attempt === maxAttempts - 1;
        const timestamp = meritTimestampUtc();
        const signature = signMeritRequest(config.apiId, config.apiKey, timestamp, rawBody);
        const url = new URL(`${config.baseUrl}${path}`);
        url.searchParams.set("apiId", config.apiId);
        url.searchParams.set("timestamp", timestamp);
        // URLSearchParams URL-encodes the base64 signature (+ / = etc.).
        url.searchParams.set("signature", signature);
        const urlString = url.toString();

        let response: Response;
        try {
          response = await fetch(urlString, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": MERIT_CLIENT_USER_AGENT,
            },
            body: rawBody,
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (e) {
          if (!isLastAttempt && isRetryableFetchFailure(e)) {
            await sleep(backoffDelayMs(attempt, retryBaseMs));
            continue;
          }
          throw createNetworkApiError("POST", urlString, e);
        }

        if (!response.ok) {
          if (!isLastAttempt && RETRYABLE_HTTP_STATUSES.has(response.status)) {
            const retryAfterMs =
              response.status === 429
                ? parseRetryAfterMs(response.headers.get("Retry-After"))
                : null;
            await response.arrayBuffer();
            const delay =
              retryAfterMs !== null ? retryAfterMs : backoffDelayMs(attempt, retryBaseMs);
            await sleep(delay);
            continue;
          }
          const text = await response.text();
          throw createHttpApiError({
            method: "POST",
            url: urlString,
            httpStatus: response.status,
            statusText: response.statusText,
            text,
          });
        }

        const text = await response.text();
        this.logRequest(path, started, undefined);
        if (response.status === 204 || text === "") {
          return undefined as T;
        }
        return parseMeritResponseText(text) as T;
      }

      /* v8 ignore next 2 - attempt loop always returns or throws */
      throw createNetworkApiError("POST", `${config.baseUrl}${path}`, new Error("loop exhausted"));
    } catch (error) {
      this.logRequest(path, started, error);
      throw error;
    }
  }

  /**
   * Fetches all pages of a paginated Merit report. When a response carries
   * `HasMore: true` with an `Id4More` cursor, continuation pages are fetched
   * via `POST /api/v2/getmoredata` with `{ Id }` until `HasMore` is false or
   * the `maxPages` cap is hit. Bare-array responses are returned as-is.
   */
  async postAllPages<T = unknown>(path: string, body?: unknown): Promise<T[]> {
    const allItems: T[] = [];
    let response = await this.post<unknown>(path, body);

    for (let pageIndex = 0; ; pageIndex++) {
      const { items, hasMore, id4More } = splitPaginationEnvelope<T>(response);
      allItems.push(...items);
      if (!hasMore || id4More === undefined) {
        return allItems;
      }
      if (pageIndex >= this.maxPages - 1) {
        this.logger.warn(
          { component: "http", path, maxPages: this.maxPages, collected: allItems.length },
          "postAllPages stopped at maxPages cap",
        );
        return allItems;
      }
      response = await this.post<unknown>(GET_MORE_DATA_PATH, { Id: id4More });
    }
  }
}
