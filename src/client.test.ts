import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rootLoggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  fatal: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  logger: rootLoggerMocks,
}));

import { signMeritRequest } from "./auth.js";
import {
  GET_MORE_DATA_PATH,
  MeritApiError,
  MeritClient,
  parseMeritResponseText,
  parseRetryAfterMs,
  splitPaginationEnvelope,
} from "./client.js";

const baseConfig = {
  apiId: "test-api-id",
  apiKey: "AoCmZGUfWMMhLJ+Eb6oRF4pAEw9XJP9b/RL5c2Gqk2w=",
  baseUrl: "https://aktiva.merit.ee",
  httpMaxRetries: 0,
  httpRetryBaseMs: 10,
  requestTimeoutMs: 30_000,
};

function jsonResponse(data: unknown, status = 200, statusText = "OK", headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("parseRetryAfterMs", () => {
  it("returns null for missing or empty header", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("")).toBeNull();
    expect(parseRetryAfterMs("   ")).toBeNull();
  });

  it("parses integer seconds and caps at 8s", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs("30")).toBe(8000);
  });

  it("returns null for negative seconds", () => {
    expect(parseRetryAfterMs("-1")).toBeNull();
  });

  it("parses HTTP-date and caps at 8s", () => {
    const now = Date.parse("Thu, 01 Jan 2026 00:00:00 GMT");
    expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:03 GMT", now)).toBe(3000);
    expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:01:00 GMT", now)).toBe(8000);
    expect(parseRetryAfterMs("Thu, 01 Jan 2025 00:00:00 GMT", now)).toBe(0);
  });

  it("returns null for unparseable values", () => {
    expect(parseRetryAfterMs("soon")).toBeNull();
  });
});

describe("parseMeritResponseText", () => {
  it("parses ordinary JSON", () => {
    expect(parseMeritResponseText('[{"Id":"x"}]')).toEqual([{ Id: "x" }]);
    expect(parseMeritResponseText('{"a":1}')).toEqual({ a: 1 });
  });

  it("unwraps double-encoded JSON strings (Merit v1 quirk)", () => {
    expect(parseMeritResponseText(JSON.stringify('[{"Id":"x"}]'))).toEqual([{ Id: "x" }]);
    expect(parseMeritResponseText(JSON.stringify('{"a":1}'))).toEqual({ a: 1 });
  });

  it("keeps JSON strings that only look like JSON", () => {
    expect(parseMeritResponseText(JSON.stringify("{not json"))).toBe("{not json");
  });

  it("keeps plain JSON strings", () => {
    expect(parseMeritResponseText('"hello"')).toBe("hello");
  });

  it("returns raw text when the body is not JSON at all", () => {
    expect(parseMeritResponseText("Invalid timestamp")).toBe("Invalid timestamp");
  });

  it("passes through JSON scalars", () => {
    expect(parseMeritResponseText("42")).toBe(42);
    expect(parseMeritResponseText("null")).toBeNull();
  });
});

describe("splitPaginationEnvelope", () => {
  it("treats bare arrays as a single page", () => {
    expect(splitPaginationEnvelope([{ Id: 1 }])).toEqual({
      items: [{ Id: 1 }],
      hasMore: false,
      id4More: undefined,
    });
  });

  it("extracts rows, HasMore, and Id4More from an envelope", () => {
    expect(
      splitPaginationEnvelope({ Rows: [{ Id: 1 }], HasMore: true, Id4More: "guid-1" }),
    ).toEqual({ items: [{ Id: 1 }], hasMore: true, id4More: "guid-1" });
  });

  it("handles envelopes without any array property", () => {
    expect(splitPaginationEnvelope({ HasMore: false })).toEqual({
      items: [],
      hasMore: false,
      id4More: undefined,
    });
  });

  it("ignores empty-string and non-string Id4More", () => {
    expect(
      splitPaginationEnvelope({ Rows: [], HasMore: true, Id4More: "" }).id4More,
    ).toBeUndefined();
    expect(
      splitPaginationEnvelope({ Rows: [], HasMore: true, Id4More: 5 }).id4More,
    ).toBeUndefined();
  });

  it("treats non-boolean HasMore as false", () => {
    expect(splitPaginationEnvelope({ Rows: [], HasMore: "yes" }).hasMore).toBe(false);
  });

  it("throws for null and primitives", () => {
    expect(() => splitPaginationEnvelope(null)).toThrow(/got null/);
    expect(() => splitPaginationEnvelope("nope")).toThrow(/got string/);
  });
});

describe("MeritClient", () => {
  let client: MeritClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new MeritClient(baseConfig);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    rootLoggerMocks.info.mockClear();
    rootLoggerMocks.warn.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe("AuthConfigSource", () => {
    it("resolves config lazily via the provided loader", () => {
      const loadConfig = vi.fn(() => baseConfig);
      const c = new MeritClient(loadConfig);
      expect(loadConfig).not.toHaveBeenCalled();
      expect(c.getConfig()).toEqual(baseConfig);
      expect(loadConfig).toHaveBeenCalledTimes(1);
    });

    it("resolves config on each request for dynamic credentials", async () => {
      let call = 0;
      const configA = { ...baseConfig, apiId: "tenant-a" };
      const configB = { ...baseConfig, apiId: "tenant-b" };
      const dynamic = new MeritClient(() => (call++ === 0 ? configA : configB));
      fetchMock.mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse([]));

      await dynamic.post("/api/v1/gettaxes");
      await dynamic.post("/api/v1/gettaxes");

      expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("apiId")).toBe("tenant-a");
      expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("apiId")).toBe("tenant-b");
    });
  });

  describe("post", () => {
    it("POSTs to baseUrl + path with signed query auth over the exact body", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));

      await client.post("/api/v1/getcustomers", { Name: "halduse" });

      const url = new URL(fetchMock.mock.calls[0][0] as string);
      expect(url.origin + url.pathname).toBe("https://aktiva.merit.ee/api/v1/getcustomers");
      expect(url.searchParams.get("apiId")).toBe("test-api-id");
      const timestamp = url.searchParams.get("timestamp");
      expect(timestamp).toMatch(/^\d{14}$/);
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(init.body).toBe('{"Name":"halduse"}');
      // The signature in the URL must match the HMAC over apiId + timestamp + rawBody.
      expect(url.searchParams.get("signature")).toBe(
        signMeritRequest(
          baseConfig.apiId,
          baseConfig.apiKey,
          timestamp as string,
          '{"Name":"halduse"}',
        ),
      );
    });

    it("URL-encodes base64 signature characters in the query string", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await client.post("/api/v1/gettaxes");
      const rawUrl = fetchMock.mock.calls[0][0] as string;
      const signature = new URL(rawUrl).searchParams.get("signature") as string;
      expect(rawUrl).toContain(`signature=${encodeURIComponent(signature)}`);
    });

    it("defaults the body to {} and signs it", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await client.post("/api/v1/gettaxes");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe("{}");
    });

    it("sends JSON content-type, accept, and user-agent headers", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await client.post("/api/v1/gettaxes");
      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers).toMatchObject({
        Accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(headers["User-Agent"]).toContain("merit-aktiva-mcp");
    });

    it("passes AbortSignal.timeout with config timeout", async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
      fetchMock.mockResolvedValue(jsonResponse([]));
      const c = new MeritClient({ ...baseConfig, requestTimeoutMs: 12_345 });

      await c.post("/api/v1/gettaxes");

      expect(timeoutSpy).toHaveBeenCalledWith(12_345);
      timeoutSpy.mockRestore();
    });

    it("falls back to env timeout when config omits requestTimeoutMs", async () => {
      vi.stubEnv("MERIT_REQUEST_TIMEOUT_MS", "7777");
      const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
      fetchMock.mockResolvedValue(jsonResponse([]));
      const { requestTimeoutMs: _omit, ...cfg } = baseConfig;
      void _omit;
      const c = new MeritClient(cfg);

      await c.post("/api/v1/gettaxes");

      expect(timeoutSpy).toHaveBeenCalledWith(7777);
      timeoutSpy.mockRestore();
    });

    it("returns undefined for 204 and empty bodies", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await expect(client.post("/api/v1/gettaxes")).resolves.toBeUndefined();
      fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
      await expect(client.post("/api/v1/gettaxes")).resolves.toBeUndefined();
    });

    it("unwraps double-encoded JSON responses", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify('[{"Id":"x"}]'), { status: 200 }));
      await expect(client.post("/api/v1/getcustomers")).resolves.toEqual([{ Id: "x" }]);
    });

    it("logs ok outcome", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await client.post("/api/v1/gettaxes");
      expect(rootLoggerMocks.info).toHaveBeenCalledWith(
        expect.objectContaining({ component: "http", outcome: "ok", path: "/api/v1/gettaxes" }),
        "merit request",
      );
    });
  });

  describe("errors", () => {
    it("throws MeritApiError for JSON error bodies and strips query from url", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ Message: "bad signature" }, 401, "Unauthorized"));
      const error = await client.post("/api/v1/gettaxes").catch((e: unknown) => e);
      expect(error).toMatchObject({
        name: "MeritApiError",
        kind: "http",
        httpStatus: 401,
      });
      expect((error as MeritApiError).message).toContain("bad signature");
      expect((error as MeritApiError).url).toBe("https://aktiva.merit.ee/api/v1/gettaxes");
      expect((error as MeritApiError).url).not.toContain("signature");
      expect(rootLoggerMocks.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "http_error", httpStatus: 401 }),
        "merit request",
      );
    });

    it("throws for plain-text error bodies (Merit quirk)", async () => {
      fetchMock.mockResolvedValue(new Response("Invalid timestamp", { status: 400 }));
      const error = await client.post("/api/v1/gettaxes").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(MeritApiError);
      expect((error as MeritApiError).message).toContain("Invalid timestamp");
    });

    it("surfaces 429 as a clear error when retries are disabled", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ Message: "slow down" }, 429, "Too Many Requests"));
      await expect(client.post("/api/v1/getaccounts")).rejects.toMatchObject({
        httpStatus: 429,
        kind: "http",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws network error on fetch failure", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      await expect(client.post("/api/v1/gettaxes")).rejects.toMatchObject({
        kind: "network",
      });
      expect(rootLoggerMocks.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "network_error" }),
        "merit request",
      );
    });

    it("logs unknown_error for non-MeritApiError throws", async () => {
      const custom = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;
      const c = new MeritClient(
        () => {
          throw new Error("config boom");
        },
        { logger: custom },
      );
      await expect(c.post("/api/v1/gettaxes")).rejects.toThrow("config boom");
      expect(custom.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "unknown_error" }),
        "merit request",
      );
    });
  });

  describe("retries", () => {
    it("regenerates timestamp and signature on 429 retries", async () => {
      vi.useFakeTimers({ now: new Date("2024-06-24T20:59:02Z") });
      const c = new MeritClient({ ...baseConfig, httpMaxRetries: 1, httpRetryBaseMs: 10 });
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ Message: "throttled" }, 429, "Too Many Requests", { "Retry-After": "2" }),
        )
        .mockResolvedValueOnce(jsonResponse([]));

      const promise = c.post("/api/v1/gettaxes");
      await vi.advanceTimersByTimeAsync(2000);
      await expect(promise).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const url1 = new URL(fetchMock.mock.calls[0][0] as string);
      const url2 = new URL(fetchMock.mock.calls[1][0] as string);
      expect(url1.searchParams.get("timestamp")).toBe("20240624205902");
      expect(url2.searchParams.get("timestamp")).toBe("20240624205904");
      // Fresh timestamp implies a fresh signature (Merit rejects reused ones).
      expect(url1.searchParams.get("signature")).not.toBe(url2.searchParams.get("signature"));
      for (const url of [url1, url2]) {
        expect(url.searchParams.get("signature")).toBe(
          signMeritRequest(
            baseConfig.apiId,
            baseConfig.apiKey,
            url.searchParams.get("timestamp") as string,
            "{}",
          ),
        );
      }
    });

    it("retries retryable HTTP statuses with backoff when Retry-After is absent", async () => {
      vi.useFakeTimers();
      const c = new MeritClient({ ...baseConfig, httpMaxRetries: 2, httpRetryBaseMs: 10 });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ Message: "busy" }, 503))
        .mockResolvedValueOnce(jsonResponse([]));

      const promise = c.post("/api/v1/gettaxes");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries network failures when enabled", async () => {
      vi.useFakeTimers();
      const c = new MeritClient({ ...baseConfig, httpMaxRetries: 1, httpRetryBaseMs: 10 });
      fetchMock
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(jsonResponse([]));

      const promise = c.post("/api/v1/gettaxes");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry AbortError / TimeoutError", async () => {
      const c = new MeritClient({ ...baseConfig, httpMaxRetries: 2, httpRetryBaseMs: 10 });
      fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
      await expect(c.post("/api/v1/gettaxes")).rejects.toMatchObject({ kind: "network" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("uses zero retries when knobs are omitted and clamps negatives", async () => {
      const { httpMaxRetries: _r, httpRetryBaseMs: _b, ...minimal } = baseConfig;
      void _r;
      void _b;
      const c1 = new MeritClient(minimal);
      fetchMock.mockImplementation(() => jsonResponse({ Message: "busy" }, 503));
      await expect(c1.post("/api/v1/gettaxes")).rejects.toMatchObject({ httpStatus: 503 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fetchMock.mockClear();
      const c2 = new MeritClient({ ...baseConfig, httpMaxRetries: -3, httpRetryBaseMs: -10 });
      await expect(c2.post("/api/v1/gettaxes")).rejects.toMatchObject({ httpStatus: 503 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("postAllPages", () => {
    it("returns bare-array responses as a single page", async () => {
      fetchMock.mockResolvedValue(jsonResponse([{ Id: 1 }, { Id: 2 }]));
      await expect(client.postAllPages("/api/v1/gettaxes")).resolves.toEqual([
        { Id: 1 },
        { Id: 2 },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("follows HasMore/Id4More via getmoredata with { Id }", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ Rows: [{ Id: 1 }], HasMore: true, Id4More: "cursor-1" }),
        )
        .mockResolvedValueOnce(jsonResponse({ Rows: [{ Id: 2 }], HasMore: false }));

      await expect(
        client.postAllPages("/api/v2/getcustpaymrep", { CustName: "x" }),
      ).resolves.toEqual([{ Id: 1 }, { Id: 2 }]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const url2 = new URL(fetchMock.mock.calls[1][0] as string);
      expect(url2.pathname).toBe(GET_MORE_DATA_PATH);
      expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe('{"Id":"cursor-1"}');
    });

    it("stops when HasMore is true but Id4More is missing", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ Rows: [{ Id: 1 }], HasMore: true }));
      await expect(client.postAllPages("/api/v2/getcustpaymrep")).resolves.toEqual([{ Id: 1 }]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("stops at maxPages and warns", async () => {
      const c = new MeritClient(baseConfig, { maxPages: 2 });
      fetchMock.mockImplementation(() =>
        jsonResponse({ Rows: [{ Id: 1 }], HasMore: true, Id4More: "again" }),
      );

      await expect(c.postAllPages("/api/v2/getcustpaymrep")).resolves.toEqual([
        { Id: 1 },
        { Id: 1 },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(rootLoggerMocks.warn).toHaveBeenCalledWith(
        expect.objectContaining({ maxPages: 2, path: "/api/v2/getcustpaymrep", collected: 2 }),
        "postAllPages stopped at maxPages cap",
      );
    });

    it("propagates envelope shape errors", async () => {
      fetchMock.mockResolvedValue(jsonResponse("nope"));
      await expect(client.postAllPages("/api/v1/gettaxes")).rejects.toThrow(/got string/);
    });
  });

  describe("custom logger option", () => {
    it("uses the provided logger", async () => {
      const custom = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;
      const c = new MeritClient(baseConfig, { logger: custom });
      fetchMock.mockResolvedValue(jsonResponse([]));
      await c.post("/api/v1/gettaxes");
      expect(custom.info).toHaveBeenCalled();
    });
  });
});
