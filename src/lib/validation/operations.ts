import { z } from "zod";
import { NoteVisibility } from "@/lib/enums";
import { optionalIsoDate, optionalString, requiredIsoDate, requiredString, uuidSchema } from "./common";

export const providerVisitSchema = z.object({
  providerId: uuidSchema,
  visitDate: requiredIsoDate,
  reviewedById: uuidSchema,
  findings: optionalString,
  actionItems: optionalString,
  /** Textarea, one URL per line — split into `documentUrls: String[]` in the DAL. */
  documentUrlsRaw: optionalString,
});
export type ProviderVisitInput = z.infer<typeof providerVisitSchema>;

export const noteAttachmentSchema = z.object({
  providerId: uuidSchema,
  categoryId: uuidSchema,
  title: requiredString("Title"),
  body: optionalString,
  fileUrl: optionalString,
  fileName: optionalString,
  mimeType: optionalString,
  retentionClassId: uuidSchema,
  visibility: z.enum(NoteVisibility).default(NoteVisibility.INTERNAL),
  effectiveDate: optionalIsoDate,
});
export type NoteAttachmentInput = z.infer<typeof noteAttachmentSchema>;
