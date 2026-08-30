import { createHmac } from "node:crypto";

export const DEFAULT_MERIT_BASE_URL = "https://aktiva.merit.ee";
export const DEFAULT_MERIT_REQUEST_TIMEOUT_MS = 30_000;

/** Descriptive User-Agent for outbound Merit API requests. */
export const MERIT_CLIENT_USER_AGENT =
  "merit-aktiva-mcp/0.1 (+https://github.com/werkstatt-jasper/merit-aktiva-mcp)";

export interface MeritAuthConfig {
  /** Api ID from Merit Aktiva > Settings > API Settings. Sent as the `apiId` query param. */
  apiId: string;
  /** Api Key — HMAC-SHA256 shared secret. Never sent on the wire. */
  apiKey: string;
  /** e.g. `https://aktiva.merit.ee` (Estonia) or `https://program.360ksiegowosc.pl` (Poland). */
  baseUrl: string;
  /** Max extra attempts after the first request (default from env or 0). */
  httpMaxRetries?: number;
  /** Base delay in ms for exponential backoff (default from env or 500). */
  httpRetryBaseMs?: number;
  /** Outbound HTTP timeout in ms (from env when unset on this object). */
  requestTimeoutMs?: number;
}

function parseNonNegativeInt(raw: string | undefined, defaultValue: number): number {
  if (raw === undefined || raw === "") {
    return defaultValue;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

/** Reads `MERIT_REQUEST_TIMEOUT_MS`; invalid or non-positive values use the default. */
export function meritRequestTimeoutMsFromEnv(): number {
  const raw = process.env.MERIT_REQUEST_TIMEOUT_MS;
  if (raw === undefined || raw === "") {
    return DEFAULT_MERIT_REQUEST_TIMEOUT_MS;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_MERIT_REQUEST_TIMEOUT_MS;
  }
  return n;
}

/** Reads Merit Aktiva credentials from the environment. */
export function loadAuthConfig(): MeritAuthConfig {
  const apiId = process.env.MERIT_API_ID;
  const apiKey = process.env.MERIT_API_KEY;
  const baseUrl = (process.env.MERIT_BASE_URL || DEFAULT_MERIT_BASE_URL).replace(/\/$/, "");

  if (!apiId) {
    throw new Error("Missing required environment variable: MERIT_API_ID");
  }
  if (!apiKey) {
    throw new Error("Missing required environment variable: MERIT_API_KEY");
  }

  return {
    apiId,
    apiKey,
    baseUrl,
    httpMaxRetries: parseNonNegativeInt(process.env.MERIT_HTTP_MAX_RETRIES, 0),
    httpRetryBaseMs: parseNonNegativeInt(process.env.MERIT_HTTP_RETRY_BASE_MS, 500),
    requestTimeoutMs: meritRequestTimeoutMsFromEnv(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * UTC timestamp in Merit's `yyyyMMddHHmmss` format. Merit rejects requests
 * whose timestamp is too old or in the future, and requires a *fresh*
 * timestamp on every retry (e.g. after HTTP 429).
 */
export function meritTimestampUtc(date: Date = new Date()): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}`
  );
}

/**
 * Merit request signature: `base64(HMAC-SHA256(apiKey, utf8(apiId + timestamp + rawBody)))`.
 *
 * The HMAC key is the Api Key's ASCII bytes as-is (not base64-decoded), and
 * `rawBody` must be the exact serialized HTTP body that is sent on the wire —
 * whitespace differences change the signature. The base64 result must be
 * URL-encoded when placed in the query string (`URLSearchParams` handles that).
 */
export function signMeritRequest(
  apiId: string,
  apiKey: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac("sha256", apiKey)
    .update(`${apiId}${timestamp}${rawBody}`, "utf8")
    .digest("base64");
}
