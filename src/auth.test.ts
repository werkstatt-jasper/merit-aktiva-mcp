import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MERIT_BASE_URL,
  DEFAULT_MERIT_REQUEST_TIMEOUT_MS,
  loadAuthConfig,
  meritRequestTimeoutMsFromEnv,
  meritTimestampUtc,
  signMeritRequest,
} from "./auth.js";

describe("loadAuthConfig", () => {
  const envKeys = [
    "MERIT_API_ID",
    "MERIT_API_KEY",
    "MERIT_BASE_URL",
    "MERIT_HTTP_MAX_RETRIES",
    "MERIT_HTTP_RETRY_BASE_MS",
    "MERIT_REQUEST_TIMEOUT_MS",
  ] as const;
  const originals: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      originals[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originals[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("throws a clear error when MERIT_API_ID is missing", () => {
    process.env.MERIT_API_KEY = "key";
    expect(() => loadAuthConfig()).toThrow("Missing required environment variable: MERIT_API_ID");
  });

  it("throws a clear error when MERIT_API_KEY is missing", () => {
    process.env.MERIT_API_ID = "id";
    expect(() => loadAuthConfig()).toThrow("Missing required environment variable: MERIT_API_KEY");
  });

  it("returns credentials with the default base URL and retry defaults", () => {
    process.env.MERIT_API_ID = "test-id";
    process.env.MERIT_API_KEY = "test-key";
    expect(loadAuthConfig()).toEqual({
      apiId: "test-id",
      apiKey: "test-key",
      baseUrl: DEFAULT_MERIT_BASE_URL,
      httpMaxRetries: 0,
      httpRetryBaseMs: 500,
      requestTimeoutMs: DEFAULT_MERIT_REQUEST_TIMEOUT_MS,
    });
  });

  it("honors MERIT_BASE_URL override and strips a trailing slash", () => {
    process.env.MERIT_API_ID = "test-id";
    process.env.MERIT_API_KEY = "test-key";
    process.env.MERIT_BASE_URL = "https://program.360ksiegowosc.pl/";
    expect(loadAuthConfig().baseUrl).toBe("https://program.360ksiegowosc.pl");
  });

  it("parses retry and timeout env knobs", () => {
    process.env.MERIT_API_ID = "test-id";
    process.env.MERIT_API_KEY = "test-key";
    process.env.MERIT_HTTP_MAX_RETRIES = "2";
    process.env.MERIT_HTTP_RETRY_BASE_MS = "250";
    process.env.MERIT_REQUEST_TIMEOUT_MS = "12000";
    expect(loadAuthConfig()).toMatchObject({
      httpMaxRetries: 2,
      httpRetryBaseMs: 250,
      requestTimeoutMs: 12000,
    });
  });

  it("falls back when retry env knobs are invalid", () => {
    process.env.MERIT_API_ID = "test-id";
    process.env.MERIT_API_KEY = "test-key";
    process.env.MERIT_HTTP_MAX_RETRIES = "nope";
    process.env.MERIT_HTTP_RETRY_BASE_MS = "-1";
    expect(loadAuthConfig()).toMatchObject({
      httpMaxRetries: 0,
      httpRetryBaseMs: 500,
    });
  });
});

describe("meritRequestTimeoutMsFromEnv", () => {
  const original = process.env.MERIT_REQUEST_TIMEOUT_MS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MERIT_REQUEST_TIMEOUT_MS;
    } else {
      process.env.MERIT_REQUEST_TIMEOUT_MS = original;
    }
  });

  it("uses the default when unset or empty", () => {
    delete process.env.MERIT_REQUEST_TIMEOUT_MS;
    expect(meritRequestTimeoutMsFromEnv()).toBe(DEFAULT_MERIT_REQUEST_TIMEOUT_MS);
    process.env.MERIT_REQUEST_TIMEOUT_MS = "";
    expect(meritRequestTimeoutMsFromEnv()).toBe(DEFAULT_MERIT_REQUEST_TIMEOUT_MS);
  });

  it("falls back when invalid or non-positive", () => {
    process.env.MERIT_REQUEST_TIMEOUT_MS = "abc";
    expect(meritRequestTimeoutMsFromEnv()).toBe(DEFAULT_MERIT_REQUEST_TIMEOUT_MS);
    process.env.MERIT_REQUEST_TIMEOUT_MS = "0";
    expect(meritRequestTimeoutMsFromEnv()).toBe(DEFAULT_MERIT_REQUEST_TIMEOUT_MS);
  });

  it("returns a positive parsed value", () => {
    process.env.MERIT_REQUEST_TIMEOUT_MS = "4500";
    expect(meritRequestTimeoutMsFromEnv()).toBe(4500);
  });
});

describe("meritTimestampUtc", () => {
  it("formats UTC yyyyMMddHHmmss", () => {
    expect(meritTimestampUtc(new Date(Date.UTC(2024, 5, 24, 20, 59, 2)))).toBe("20240624205902");
  });

  it("zero-pads single-digit components", () => {
    expect(meritTimestampUtc(new Date(Date.UTC(2026, 0, 5, 3, 4, 5)))).toBe("20260105030405");
  });

  it("defaults to the current time", () => {
    expect(meritTimestampUtc()).toMatch(/^\d{14}$/);
  });
});

describe("signMeritRequest", () => {
  // Official vector from https://api.merit.ee/connecting-robots/reference-manual/authentication/
  const apiId = "670fe52f-558a-4be8-ade0-526e01a106d0";
  const apiKey = "AoCmZGUfWMMhLJ+Eb6oRF4pAEw9XJP9b/RL5c2Gqk2w=";
  const timestamp = "20240624205902";
  const expectedSignature = "dt6dkfuj+OfX01YkvvAoN/fekAUGr6AvVlQhUUja9Qc=";

  it("reproduces the official documentation example", () => {
    // Finding (verified 2026-08-30): the docs display the example body
    // pretty-printed ("{ \"CustName\": ... }"), but the published signature
    // was generated from the *compact* JSON serialization below — signing the
    // pretty-printed string yields a different HMAC. Merit signs the exact
    // raw body bytes sent on the wire, and MeritClient always sends
    // JSON.stringify output, so the compact form is the correct fixture.
    const rawBody = JSON.stringify({
      CustName: "Kliendinimi",
      CustId: "3a274294-9c60-4a3d-93f0-1874253f073e",
      OverDueDays: 5,
      DebtDate: "20220501",
    });
    expect(signMeritRequest(apiId, apiKey, timestamp, rawBody)).toBe(expectedSignature);
  });

  it("produces a different signature for a different body (whitespace matters)", () => {
    const prettyBody =
      '{ "CustName": "Kliendinimi", "CustId": "3a274294-9c60-4a3d-93f0-1874253f073e", "OverDueDays": 5, "DebtDate": "20220501"}';
    expect(signMeritRequest(apiId, apiKey, timestamp, prettyBody)).not.toBe(expectedSignature);
  });

  it("signs empty-object bodies", () => {
    expect(signMeritRequest(apiId, apiKey, timestamp, "{}")).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
