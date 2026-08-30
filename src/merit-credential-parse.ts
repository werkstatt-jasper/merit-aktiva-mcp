import { DEFAULT_MERIT_BASE_URL, type MeritAuthConfig } from "./auth.js";

type TenantCredentialEntry = {
  apiId: string;
  apiKey: string;
  baseUrl?: string;
  httpMaxRetries?: number;
  httpRetryBaseMs?: number;
  requestTimeoutMs?: number;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/**
 * Parses Merit Aktiva credentials from JSON (decrypted tenant DB payload).
 * When `baseUrlFromColumn` is set (e.g. from `api_credentials.base_url`), it
 * wins; otherwise JSON `baseUrl` or {@link DEFAULT_MERIT_BASE_URL}.
 *
 * Never logs the key material.
 */
export function parseMeritAuthCredentialJson(
  raw: unknown,
  keyLabel: string,
  baseUrlFromColumn?: string,
): MeritAuthConfig {
  if (raw === null || typeof raw !== "object") {
    throw new Error(`Tenant "${keyLabel}": value must be a JSON object`);
  }
  const o = raw as TenantCredentialEntry;
  if (!isNonEmptyString(o.apiId)) {
    throw new Error(`Tenant "${keyLabel}": missing or empty apiId`);
  }
  if (!isNonEmptyString(o.apiKey)) {
    throw new Error(`Tenant "${keyLabel}": missing or empty apiKey`);
  }

  let baseUrl: string;
  if (baseUrlFromColumn !== undefined) {
    if (!isNonEmptyString(baseUrlFromColumn)) {
      throw new Error(`Tenant "${keyLabel}": baseUrl must be non-empty`);
    }
    baseUrl = baseUrlFromColumn.trim().replace(/\/$/, "");
  } else if (isNonEmptyString(o.baseUrl)) {
    baseUrl = o.baseUrl.trim().replace(/\/$/, "");
  } else {
    baseUrl = DEFAULT_MERIT_BASE_URL;
  }

  const config: MeritAuthConfig = {
    apiId: o.apiId.trim(),
    apiKey: o.apiKey.trim(),
    baseUrl,
  };
  if (o.httpMaxRetries !== undefined) {
    if (!Number.isInteger(o.httpMaxRetries) || o.httpMaxRetries < 0) {
      throw new Error(`Tenant "${keyLabel}": httpMaxRetries must be a non-negative integer`);
    }
    config.httpMaxRetries = o.httpMaxRetries;
  }
  if (o.httpRetryBaseMs !== undefined) {
    if (!Number.isInteger(o.httpRetryBaseMs) || o.httpRetryBaseMs < 0) {
      throw new Error(`Tenant "${keyLabel}": httpRetryBaseMs must be a non-negative integer`);
    }
    config.httpRetryBaseMs = o.httpRetryBaseMs;
  }
  if (o.requestTimeoutMs !== undefined) {
    if (!Number.isInteger(o.requestTimeoutMs) || o.requestTimeoutMs < 1) {
      throw new Error(`Tenant "${keyLabel}": requestTimeoutMs must be a positive integer`);
    }
    config.requestTimeoutMs = o.requestTimeoutMs;
  }
  return config;
}
