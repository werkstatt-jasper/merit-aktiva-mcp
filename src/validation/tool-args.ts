import { type ZodType, z } from "zod";

/** Calendar date `YYYY-MM-DD` (invalid dates like 2024-13-40 rejected). */
export const ymdDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Invalid calendar date");

/** Converts a validated ISO `YYYY-MM-DD` date to Merit's `yyyymmdd` wire format. */
export function isoToMeritDate(iso: string): string {
  return iso.replaceAll("-", "");
}

/** Required ISO date arg, transformed to Merit `yyyymmdd`. */
export const requiredMeritDate = ymdDateString.transform(isoToMeritDate);

/** Optional ISO date arg transformed to Merit `yyyymmdd`; null/undefined omitted. */
export const optionalMeritDate = ymdDateString
  .nullish()
  .transform((v) => (v == null ? undefined : isoToMeritDate(v)));

/** Merit object ids are GUIDs. */
export const guidString = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Expected a GUID like 3a274294-9c60-4a3d-93f0-1874253f073e",
  );

export const optionalGuid = guidString.nullish().transform((v) => v ?? undefined);

/** Optional string; null coerced to undefined. */
export const optionalString = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);

/** Optional boolean; null coerced to undefined. */
export const optionalBoolean = z
  .boolean()
  .nullish()
  .transform((v) => v ?? undefined);

/** Optional integer (coerced so string "42" from JSON-ish clients still validates). */
export const optionalInt = z.coerce
  .number()
  .int()
  .nullish()
  .transform((v) => v ?? undefined);

/** Optional Merit `DateType`: 0 = document date, 1 = changed date. */
export const optionalDateType = z
  .union([z.literal(0), z.literal(1)])
  .nullish()
  .transform((v) => v ?? undefined);

/** Optional GetPOrders `DateFilter`: 0 = off, 1 = document date, 2 = created date. */
export const optionalPurchaseOrderDateFilter = z
  .union([z.literal(0), z.literal(1), z.literal(2)])
  .nullish()
  .transform((v) => v ?? undefined);

/** Required number (coerced so string "12.5" from JSON-ish clients still validates). */
export const requiredNumber = z.coerce.number();

/** Optional number; null coerced to undefined. */
export const optionalNumber = z.coerce
  .number()
  .nullish()
  .transform((v) => v ?? undefined);

/** Required integer (coerced). */
export const requiredInt = z.coerce.number().int();

const ISO_DATETIME_RE =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

/**
 * Converts ISO `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm[:ss]` to Merit's `yyyyMMddHHmm`
 * (`PaymentDate` on sendPaymentV). Date-only values become midnight (`0000`).
 */
export function isoToMeritDateTime(iso: string): string {
  const match = ISO_DATETIME_RE.exec(iso);
  if (!match) {
    throw new Error(`Expected YYYY-MM-DD or YYYY-MM-DDTHH:mm, got ${iso}`);
  }
  const datePart = match[1].replaceAll("-", "");
  const hour = match[2] ?? "00";
  const minute = match[3] ?? "00";
  return `${datePart}${hour}${minute}`;
}

const isoDateTimeString = z.string().refine((s) => {
  const match = ISO_DATETIME_RE.exec(s);
  if (!match) return false;
  const [y, m, d] = match[1].split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return false;
  }
  if (match[2] != null) {
    const hour = Number(match[2]);
    const minute = Number(match[3]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }
  return true;
}, "Expected YYYY-MM-DD or YYYY-MM-DDTHH:mm");

/** Required ISO date or datetime, transformed to Merit `yyyyMMddHHmm`. */
export const requiredMeritDateTime = isoDateTimeString.transform(isoToMeritDateTime);

/** Optional ISO date or datetime transformed to Merit `yyyyMMddHHmm`. */
export const optionalMeritDateTime = isoDateTimeString
  .nullish()
  .transform((v) => (v == null ? undefined : isoToMeritDateTime(v)));

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseToolArgs<T extends ZodType>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw ?? {});
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  return result.data;
}
