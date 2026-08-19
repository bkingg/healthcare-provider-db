import { z } from "zod";
import { DqResolution, DqStatus } from "@/lib/enums";
import { optionalString, uuidSchema } from "./common";

export const uploadImportBatchSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.size > 0, "File is empty")
    .refine((f) => f.name.toLowerCase().endsWith(".csv"), "Only .csv files are supported in this phase"),
  notes: optionalString,
  // Instructions for the (not-yet-connected) AI scrub/dedupe/standardize
  // tool — captured now so it's ready to hand off once that's wired up; see
  // ImportBatch.aiPrompt.
  aiPrompt: optionalString,
});
export type UploadImportBatchInput = z.infer<typeof uploadImportBatchSchema>;

export const confirmImportBatchSchema = z.object({
  id: uuidSchema,
});

export const assignExceptionSchema = z.object({
  id: uuidSchema,
});

export const resolveExceptionSchema = z.object({
  id: uuidSchema,
  resolutionDecision: z.enum(DqResolution),
  resolutionNotes: optionalString,
});

export const exceptionFilterSchema = z.object({
  status: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.enum(DqStatus).optional()),
  importBatchId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.uuid().optional()),
});
export type ExceptionFilters = z.infer<typeof exceptionFilterSchema>;

export function parseExceptionFilters(searchParams: Record<string, string | string[] | undefined>): ExceptionFilters {
  const normalized = Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = exceptionFilterSchema.safeParse(normalized);
  return parsed.success ? parsed.data : {};
}
