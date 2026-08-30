import { describe, expect, it } from "vitest";
import { DEFAULT_MERIT_BASE_URL } from "./auth.js";
import { parseMeritAuthCredentialJson } from "./merit-credential-parse.js";

describe("parseMeritAuthCredentialJson", () => {
  it("parses apiId/apiKey and defaults baseUrl", () => {
    expect(parseMeritAuthCredentialJson({ apiId: " id ", apiKey: " key " }, "k")).toEqual({
      apiId: "id",
      apiKey: "key",
      baseUrl: DEFAULT_MERIT_BASE_URL,
    });
  });

  it("prefers baseUrlFromColumn over JSON baseUrl", () => {
    expect(
      parseMeritAuthCredentialJson(
        { apiId: "i", apiKey: "k", baseUrl: "https://other.example/" },
        "k",
        "https://program.360ksiegowosc.pl/",
      ),
    ).toEqual({
      apiId: "i",
      apiKey: "k",
      baseUrl: "https://program.360ksiegowosc.pl",
    });
  });

  it("uses JSON baseUrl when column omitted", () => {
    expect(
      parseMeritAuthCredentialJson(
        { apiId: "i", apiKey: "k", baseUrl: "https://custom.example/" },
        "k",
      ),
    ).toEqual({
      apiId: "i",
      apiKey: "k",
      baseUrl: "https://custom.example",
    });
  });

  it("rejects non-object payloads", () => {
    expect(() => parseMeritAuthCredentialJson(null, "k")).toThrow(/must be a JSON object/);
    expect(() => parseMeritAuthCredentialJson("str", "k")).toThrow(/must be a JSON object/);
  });

  it("rejects missing or empty apiId / apiKey", () => {
    expect(() => parseMeritAuthCredentialJson({ apiKey: "k" }, "k")).toThrow(/apiId/);
    expect(() => parseMeritAuthCredentialJson({ apiId: " ", apiKey: "k" }, "k")).toThrow(/apiId/);
    expect(() => parseMeritAuthCredentialJson({ apiId: "i" }, "k")).toThrow(/apiKey/);
    expect(() => parseMeritAuthCredentialJson({ apiId: "i", apiKey: "" }, "k")).toThrow(/apiKey/);
  });

  it("rejects empty baseUrlFromColumn", () => {
    expect(() => parseMeritAuthCredentialJson({ apiId: "i", apiKey: "k" }, "k", "  ")).toThrow(
      /baseUrl must be non-empty/,
    );
  });

  it("accepts optional retry/timeout fields", () => {
    expect(
      parseMeritAuthCredentialJson(
        {
          apiId: "i",
          apiKey: "k",
          httpMaxRetries: 2,
          httpRetryBaseMs: 500,
          requestTimeoutMs: 10000,
        },
        "k",
        "https://aktiva.merit.ee",
      ),
    ).toEqual({
      apiId: "i",
      apiKey: "k",
      baseUrl: "https://aktiva.merit.ee",
      httpMaxRetries: 2,
      httpRetryBaseMs: 500,
      requestTimeoutMs: 10000,
    });
  });

  it("rejects invalid optional numbers", () => {
    expect(() =>
      parseMeritAuthCredentialJson({ apiId: "i", apiKey: "k", httpMaxRetries: -1 }, "k"),
    ).toThrow(/httpMaxRetries/);
    expect(() =>
      parseMeritAuthCredentialJson({ apiId: "i", apiKey: "k", httpRetryBaseMs: -1 }, "k"),
    ).toThrow(/httpRetryBaseMs/);
    expect(() =>
      parseMeritAuthCredentialJson({ apiId: "i", apiKey: "k", requestTimeoutMs: 0 }, "k"),
    ).toThrow(/requestTimeoutMs/);
  });
});
