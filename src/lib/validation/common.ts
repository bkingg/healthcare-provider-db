import { z } from "zod";

/**
 * Shared primitives for form-backed Zod schemas. Every schema in this app
 * parses `FormData` values, which arrive as strings (or File) — these
 * helpers normalize the "empty string means not provided" reality of HTML
 * forms into `undefined` before the rest of a schema sees it.
 */

export const uuidSchema = z.uuid();

export const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.uuid().optional());

export const requiredString = (label: string) => z.string().trim().min(1, `${label} is required`);

export const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.url("Enter a valid URL, including https://").optional());

// `z.iso.date()` only validates the "YYYY-MM-DD" shape; Prisma's `DateTime`
// columns (including `@db.Date` ones) reject that bare string ("premature
// end of input. Expected ISO-8601 DateTime") and need an actual `Date`.
export const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.iso.date().optional())
  .transform((v) => (v ? new Date(v) : undefined));

export const requiredIsoDate = z.iso.date("Enter a valid date").transform((v) => new Date(v));

// A `<input type="time">` value ("HH:MM", 24-hour) anchored to a fixed epoch
// date so it can live in a Prisma `DateTime @db.Time` column — Postgres's
// TIME type ignores the date part, but Prisma Client still needs a real
// `Date` in and out. Always built/read in UTC (the trailing "Z") so the
// server's own timezone never shifts the wall-clock time a user typed.
export const requiredTimeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time")
  .transform((v) => new Date(`1970-01-01T${v}:00.000Z`));

export const decimalString = z
  .string()
  .trim()
  .refine((v) => v !== "" && !Number.isNaN(Number(v)), "Must be a number");

export const optionalPositiveInt = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(
    z
      .string()
      .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, "Must be a positive whole number")
      .transform((v) => Number(v))
      .optional(),
  );

export const optionalDecimalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(
    z
      .string()
      .refine((v) => !Number.isNaN(Number(v)), "Must be a number")
      .optional(),
  );

// A `z.union([..., z.undefined()])` looks like it should accept a missing
// key, but Zod v4 treats "key absent from the object" as failing a
// non-optional field regardless of whether the value schema accepts
// `undefined` — it only accepts a key that's actually .optional() on the
// object shape. An unchecked HTML checkbox omits its key from FormData
// entirely, so this must be `.optional()`, not a union with z.undefined()
// (found the hard way: every existing isPrimary checkbox silently rejected
// "unchecked" until this was fixed).
export const checkboxValue = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; errors: Record<string, string[]> };

export function fail(errors: Record<string, string[] | undefined>): ActionResult<never> {
  const cleaned: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (value?.length) cleaned[key] = value;
  }
  return { success: false, errors: cleaned };
}
