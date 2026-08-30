import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  formatZodError,
  guidString,
  isoToMeritDate,
  isoToMeritDateTime,
  optionalBoolean,
  optionalDateType,
  optionalGuid,
  optionalInt,
  optionalMeritDate,
  optionalMeritDateTime,
  optionalNumber,
  optionalPurchaseOrderDateFilter,
  optionalString,
  parseToolArgs,
  requiredInt,
  requiredMeritDate,
  requiredMeritDateTime,
  requiredNumber,
  ymdDateString,
} from "./tool-args.js";

describe("ymdDateString", () => {
  it("accepts valid calendar dates", () => {
    expect(ymdDateString.parse("2026-02-28")).toBe("2026-02-28");
  });

  it("rejects wrong format", () => {
    expect(ymdDateString.safeParse("28.02.2026").success).toBe(false);
    expect(ymdDateString.safeParse("20260228").success).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(ymdDateString.safeParse("2026-13-40").success).toBe(false);
    expect(ymdDateString.safeParse("2026-02-30").success).toBe(false);
  });
});

describe("isoToMeritDate / requiredMeritDate / optionalMeritDate", () => {
  it("converts ISO to Merit yyyymmdd", () => {
    expect(isoToMeritDate("2026-08-30")).toBe("20260830");
  });

  it("requiredMeritDate transforms and validates", () => {
    expect(requiredMeritDate.parse("2026-01-05")).toBe("20260105");
    expect(requiredMeritDate.safeParse("bad").success).toBe(false);
  });

  it("optionalMeritDate passes undefined/null through as undefined", () => {
    expect(optionalMeritDate.parse(undefined)).toBeUndefined();
    expect(optionalMeritDate.parse(null)).toBeUndefined();
    expect(optionalMeritDate.parse("2026-06-01")).toBe("20260601");
  });
});

describe("guidString / optionalGuid", () => {
  it("accepts GUIDs", () => {
    expect(guidString.parse("3a274294-9c60-4a3d-93f0-1874253f073e")).toBe(
      "3a274294-9c60-4a3d-93f0-1874253f073e",
    );
  });

  it("rejects non-GUIDs", () => {
    expect(guidString.safeParse("not-a-guid").success).toBe(false);
  });

  it("optionalGuid coerces null to undefined", () => {
    expect(optionalGuid.parse(null)).toBeUndefined();
    expect(optionalGuid.parse("3a274294-9c60-4a3d-93f0-1874253f073e")).toBe(
      "3a274294-9c60-4a3d-93f0-1874253f073e",
    );
  });
});

describe("optional primitives", () => {
  it("optionalString", () => {
    expect(optionalString.parse("x")).toBe("x");
    expect(optionalString.parse(null)).toBeUndefined();
    expect(optionalString.safeParse(5).success).toBe(false);
  });

  it("optionalBoolean", () => {
    expect(optionalBoolean.parse(true)).toBe(true);
    expect(optionalBoolean.parse(null)).toBeUndefined();
    expect(optionalBoolean.safeParse("yes").success).toBe(false);
  });

  it("optionalInt coerces numeric strings", () => {
    expect(optionalInt.parse("42")).toBe(42);
    expect(optionalInt.parse(7)).toBe(7);
    expect(optionalInt.parse(null)).toBeUndefined();
    expect(optionalInt.safeParse(1.5).success).toBe(false);
  });

  it("optionalDateType allows only 0 or 1", () => {
    expect(optionalDateType.parse(0)).toBe(0);
    expect(optionalDateType.parse(1)).toBe(1);
    expect(optionalDateType.parse(null)).toBeUndefined();
    expect(optionalDateType.safeParse(2).success).toBe(false);
  });

  it("optionalPurchaseOrderDateFilter allows 0, 1, 2", () => {
    expect(optionalPurchaseOrderDateFilter.parse(0)).toBe(0);
    expect(optionalPurchaseOrderDateFilter.parse(2)).toBe(2);
    expect(optionalPurchaseOrderDateFilter.parse(null)).toBeUndefined();
    expect(optionalPurchaseOrderDateFilter.safeParse(3).success).toBe(false);
  });

  it("requiredNumber / optionalNumber / requiredInt", () => {
    expect(requiredNumber.parse("12.5")).toBe(12.5);
    expect(optionalNumber.parse(null)).toBeUndefined();
    expect(optionalNumber.parse("3")).toBe(3);
    expect(requiredInt.parse("7")).toBe(7);
    expect(requiredInt.safeParse(1.5).success).toBe(false);
  });
});

describe("isoToMeritDateTime / requiredMeritDateTime / optionalMeritDateTime", () => {
  it("converts date-only ISO to midnight yyyyMMddHHmm", () => {
    expect(isoToMeritDateTime("2026-08-30")).toBe("202608300000");
  });

  it("converts ISO datetime to yyyyMMddHHmm (drops seconds)", () => {
    expect(isoToMeritDateTime("2026-08-30T14:05")).toBe("202608301405");
    expect(isoToMeritDateTime("2026-08-30T14:05:59")).toBe("202608301405");
    expect(isoToMeritDateTime("2026-08-30 09:00")).toBe("202608300900");
    expect(isoToMeritDateTime("2026-08-30T14:05:00Z")).toBe("202608301405");
  });

  it("requiredMeritDateTime validates calendar and clock", () => {
    expect(requiredMeritDateTime.parse("2026-01-05T08:30")).toBe("202601050830");
    expect(requiredMeritDateTime.safeParse("bad").success).toBe(false);
    expect(requiredMeritDateTime.safeParse("2026-02-30T10:00").success).toBe(false);
    expect(requiredMeritDateTime.safeParse("2026-01-01T25:00").success).toBe(false);
  });

  it("optionalMeritDateTime passes undefined/null through", () => {
    expect(optionalMeritDateTime.parse(undefined)).toBeUndefined();
    expect(optionalMeritDateTime.parse(null)).toBeUndefined();
    expect(optionalMeritDateTime.parse("2026-06-01")).toBe("202606010000");
  });

  it("isoToMeritDateTime throws on unparseable input", () => {
    expect(() => isoToMeritDateTime("nope")).toThrow(/Expected YYYY-MM-DD/);
  });
});

describe("formatZodError / parseToolArgs", () => {
  const schema = z.object({ periodStart: requiredMeritDate });

  it("formats issues with paths", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toMatch(/periodStart:/);
    }
  });

  it("formats root-level issues", () => {
    const result = z.string().safeParse(42);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toMatch(/^\(root\):/);
    }
  });

  it("parseToolArgs returns parsed data", () => {
    expect(parseToolArgs(schema, { periodStart: "2026-01-01" })).toEqual({
      periodStart: "20260101",
    });
  });

  it("parseToolArgs treats missing args as empty object", () => {
    expect(parseToolArgs(z.object({ name: optionalString }), undefined)).toEqual({});
  });

  it("parseToolArgs throws formatted errors", () => {
    expect(() => parseToolArgs(schema, { periodStart: "nope" })).toThrow(/periodStart/);
  });
});
