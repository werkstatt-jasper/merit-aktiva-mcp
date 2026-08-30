import { describe, expect, it } from "vitest";
import {
  clientFacingRequestLabel,
  createHttpApiError,
  createNetworkApiError,
  isRetryableFetchFailure,
  MeritApiError,
  RETRYABLE_HTTP_STATUSES,
  stripUrlQuery,
  truncateBodySnippet,
} from "./api-error.js";

const SIGNED_URL =
  "https://aktiva.merit.ee/api/v1/gettaxes?apiId=id&timestamp=20240624205902&signature=abc%3D";

describe("MeritApiError", () => {
  it("stores fields and strips auth query params from the url", () => {
    const err = new MeritApiError({
      kind: "http",
      message: "boom",
      httpStatus: 500,
      method: "POST",
      url: SIGNED_URL,
      bodySnippet: "snippet",
    });
    expect(err.name).toBe("MeritApiError");
    expect(err.kind).toBe("http");
    expect(err.httpStatus).toBe(500);
    expect(err.method).toBe("POST");
    expect(err.url).toBe("https://aktiva.merit.ee/api/v1/gettaxes");
    expect(err.bodySnippet).toBe("snippet");
    expect(err).toBeInstanceOf(MeritApiError);
    expect(err).toBeInstanceOf(Error);
  });

  it("attaches cause when provided", () => {
    const cause = new Error("root");
    const err = new MeritApiError({
      kind: "network",
      message: "net",
      method: "POST",
      url: "not a url",
      cause,
    });
    expect(err.cause).toBe(cause);
    expect(err.url).toBe("not a url");
    expect(err.httpStatus).toBeUndefined();
  });
});

describe("truncateBodySnippet", () => {
  it("returns short text unchanged", () => {
    expect(truncateBodySnippet("short")).toBe("short");
  });

  it("truncates long text to the cap", () => {
    const long = "x".repeat(600);
    expect(truncateBodySnippet(long)).toHaveLength(500);
  });
});

describe("stripUrlQuery", () => {
  it("drops query string and hash", () => {
    expect(stripUrlQuery(SIGNED_URL)).toBe("https://aktiva.merit.ee/api/v1/gettaxes");
  });

  it("returns unparseable urls unchanged", () => {
    expect(stripUrlQuery("::not-a-url::")).toBe("::not-a-url::");
  });
});

describe("clientFacingRequestLabel", () => {
  it("shows method and pathname only", () => {
    expect(clientFacingRequestLabel("POST", SIGNED_URL)).toBe("[POST /api/v1/gettaxes]");
  });

  it("falls back to method only for unparseable urls", () => {
    expect(clientFacingRequestLabel("POST", "::not-a-url::")).toBe("[POST]");
  });
});

describe("isRetryableFetchFailure", () => {
  it("treats generic fetch failures as retryable", () => {
    expect(isRetryableFetchFailure(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryableFetchFailure("weird")).toBe(true);
  });

  it("does not retry aborts and timeouts", () => {
    expect(isRetryableFetchFailure(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isRetryableFetchFailure(new DOMException("timed out", "TimeoutError"))).toBe(false);
  });

  it("retries other DOMExceptions", () => {
    expect(isRetryableFetchFailure(new DOMException("other", "DataError"))).toBe(true);
  });
});

describe("RETRYABLE_HTTP_STATUSES", () => {
  it("covers 408/429/5xx", () => {
    expect([...RETRYABLE_HTTP_STATUSES].sort()).toEqual([408, 429, 500, 502, 503, 504]);
  });
});

describe("createHttpApiError", () => {
  const base = { method: "POST", url: SIGNED_URL, httpStatus: 400, statusText: "Bad Request" };

  it("extracts Message from JSON error bodies", () => {
    const err = createHttpApiError({ ...base, text: JSON.stringify({ Message: "Bad period" }) });
    expect(err.message).toBe("Merit API error 400: Bad period [POST /api/v1/gettaxes]");
    expect(err.httpStatus).toBe(400);
  });

  it("extracts lowercase message and error keys", () => {
    expect(createHttpApiError({ ...base, text: '{"message":"lower"}' }).message).toContain("lower");
    expect(createHttpApiError({ ...base, text: '{"error":"errkey"}' }).message).toContain("errkey");
    expect(createHttpApiError({ ...base, text: '{"ErrorMessage":"pascal"}' }).message).toContain(
      "pascal",
    );
  });

  it("skips empty or non-string JSON message keys", () => {
    const err = createHttpApiError({ ...base, text: '{"Message":"","code":7}' });
    expect(err.message).toContain('{"Message":"","code":7}');
  });

  it("stringifies JSON objects without known message keys", () => {
    const err = createHttpApiError({ ...base, text: '{"foo":1}' });
    expect(err.message).toContain('{"foo":1}');
  });

  it("uses the raw snippet for plain-text bodies (Merit quirk)", () => {
    const err = createHttpApiError({ ...base, text: "Invalid timestamp" });
    expect(err.message).toBe("Merit API error 400: Invalid timestamp [POST /api/v1/gettaxes]");
    expect(err.bodySnippet).toBe("Invalid timestamp");
  });

  it("ignores JSON arrays and null bodies", () => {
    expect(createHttpApiError({ ...base, text: "[1,2]" }).message).toContain("[1,2]");
    expect(createHttpApiError({ ...base, text: "null" }).message).toContain("null");
  });

  it("falls back to statusText when the body is empty", () => {
    const err = createHttpApiError({
      ...base,
      httpStatus: 502,
      statusText: "Bad Gateway",
      text: "",
    });
    expect(err.message).toBe("Merit API error 502: Bad Gateway [POST /api/v1/gettaxes]");
  });

  it("truncates long plain-text bodies in the snippet", () => {
    const err = createHttpApiError({ ...base, text: "y".repeat(700) });
    expect(err.bodySnippet).toHaveLength(500);
  });
});

describe("createNetworkApiError", () => {
  it("wraps Error causes with their message", () => {
    const err = createNetworkApiError("POST", SIGNED_URL, new TypeError("fetch failed"));
    expect(err.kind).toBe("network");
    expect(err.message).toBe("Network error: fetch failed [POST /api/v1/gettaxes]");
    expect(err.url).toBe("https://aktiva.merit.ee/api/v1/gettaxes");
  });

  it("stringifies non-Error causes", () => {
    const err = createNetworkApiError("POST", SIGNED_URL, "socket closed");
    expect(err.message).toContain("socket closed");
  });
});
