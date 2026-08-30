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
