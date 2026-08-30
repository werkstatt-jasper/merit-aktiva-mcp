const SNIPPET_MAX = 500;

export type MeritErrorKind = "http" | "network";

export interface MeritApiErrorOptions {
  kind: MeritErrorKind;
  message: string;
  httpStatus?: number;
  method: string;
  url: string;
  bodySnippet?: string;
  cause?: unknown;
}

export class MeritApiError extends Error {
  readonly kind: MeritErrorKind;
  readonly httpStatus?: number;
  readonly method: string;
  /** Origin + path only — Merit auth params (apiId/signature) travel in the query string. */
  readonly url: string;
  readonly bodySnippet?: string;

  constructor(options: MeritApiErrorOptions) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "MeritApiError";
    this.kind = options.kind;
    this.httpStatus = options.httpStatus;
    this.method = options.method;
    this.url = stripUrlQuery(options.url);
    this.bodySnippet = options.bodySnippet;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function truncateBodySnippet(text: string, max = SNIPPET_MAX): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max);
}

/** Drops query string and hash; Merit request URLs carry auth material in the query. */
export function stripUrlQuery(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

/** Safe suffix for client-visible error messages: method + pathname only. */
export function clientFacingRequestLabel(method: string, url: string): string {
  try {
    const u = new URL(url);
    return `[${method} ${u.pathname}]`;
  } catch {
    return `[${method}]`;
  }
}

/** HTTP statuses that may be transient; other 4xx (except 408/429) are excluded. */
export const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function isRetryableFetchFailure(error: unknown): boolean {
  return !(
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/**
 * Extracts a human-readable message from a JSON error body when possible.
 * Merit mixes JSON error envelopes with plain-text error bodies.
 */
function extractJsonErrorMessage(text: string): string | undefined {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  for (const key of ["Message", "message", "error", "ErrorMessage"]) {
    const value = record[key];
    if (typeof value === "string" && value !== "") {
      return value;
    }
  }
  return JSON.stringify(record);
}

export function createHttpApiError(params: {
  method: string;
  url: string;
  httpStatus: number;
  statusText: string;
  text: string;
}): MeritApiError {
  const snippet = truncateBodySnippet(params.text);
  const label = clientFacingRequestLabel(params.method, params.url);
  const detail =
    extractJsonErrorMessage(params.text) ??
    (params.text.trim() !== "" ? snippet : params.statusText);
  return new MeritApiError({
    kind: "http",
    message: `Merit API error ${params.httpStatus}: ${detail} ${label}`,
    httpStatus: params.httpStatus,
    method: params.method,
    url: params.url,
    bodySnippet: snippet,
  });
}

export function createNetworkApiError(method: string, url: string, cause: unknown): MeritApiError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new MeritApiError({
    kind: "network",
    message: `Network error: ${detail} ${clientFacingRequestLabel(method, url)}`,
    method,
    url,
    cause,
  });
}
