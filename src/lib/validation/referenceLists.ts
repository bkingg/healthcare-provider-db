import { z } from "zod";
import { REFERENCE_LIST_DEFS, type FieldDef, type ReferenceListKey } from "@/lib/referenceListDefs";
import { checkboxValue, optionalString, requiredString } from "./common";

/** One schema shape covers every field kind the admin tab's generic form
 * can render — see FieldDef in referenceListDefs.ts. Built dynamically from
 * that same config (rather than 20 hand-written schemas) so the form and its
 * validation can never drift apart. */
function schemaForField(f: FieldDef): z.ZodTypeAny {
  switch (f.kind) {
    case "text":
    case "textarea":
      return f.required ? requiredString(f.labelKey) : optionalString;
    case "number": {
      const parsed = z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .refine((v) => v === undefined || !Number.isNaN(v), "Must be a number");
      return f.required ? parsed.refine((v) => v !== undefined, `${f.labelKey} is required`) : parsed;
    }
    case "select":
      return f.required
        ? z.enum(f.options as [string, ...string[]])
        : z
            .string()
            .trim()
            .optional()
            .transform((v) => (v ? v : undefined))
            .pipe(z.enum(f.options as [string, ...string[]]).optional());
    case "refSelect": {
      const opt = z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : undefined))
        .pipe(z.uuid().optional());
      return f.required ? opt.refine((v) => v !== undefined, `${f.labelKey} is required`) : opt;
    }
    case "checkbox":
      return checkboxValue;
  }
}

export function referenceItemSchema(listKey: ReferenceListKey) {
  const def = REFERENCE_LIST_DEFS[listKey];
  const shape: Record<string, z.ZodTypeAny> = {
    [def.codeField.key]: requiredString(def.codeField.labelKey),
  };
  for (const field of def.fields) shape[field.key] = schemaForField(field);
  return z.object(shape);
}
