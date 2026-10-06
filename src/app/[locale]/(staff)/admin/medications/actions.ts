"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireEditValueLists } from "@/lib/rbac";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { fail, type ActionResult } from "@/lib/validation/common";
import { REGULATORY_CLASSES } from "@/lib/medications";
import { checkMedicationRows, summarizeMedications } from "@/lib/import/medicationImport";
import { createMedication, setMedicationActive, updateMedication } from "@/data/medications";
import { commitMedicationImport, loadCatalogByCode, readMedicationFile } from "@/data/medicationImport";

/** The catalog is reference data: edited by whoever may edit value lists,
 * re-checked here since a form POST doesn't hide behind the UI. */
async function requireCatalogEditor() {
  const actor = await getCurrentActor();
  requireEditValueLists(actor);
  return actor;
}

function refresh() {
  revalidatePath("/[locale]/(staff)/admin/medications", "layout");
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Too long")
    .optional()
    .transform((v) => (v ? v : null));
const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "on");

const medicationSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._-]{1,40}$/, "Letters, numbers, dots, dashes and underscores only (max 40)"),
  dci: z.string().trim().min(1, "Required").max(200, "Too long"),
  brandName: optional(200),
  strength: optional(100),
  form: z.string().trim().min(1, "Required").max(100, "Too long"),
  presentation: optional(200),
  therapeuticClass: optional(200),
  regulatoryClass: z.enum(REGULATORY_CLASSES),
  isPsychotropic: flag,
  isColdChain: flag,
  prescriptionRequired: flag,
  source: optional(100),
});

export async function saveMedicationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCatalogEditor();
  const parsed = medicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  const { id, ...input } = parsed.data;
  try {
    if (id) await updateMedication(id, input, actor.id);
    else await createMedication(input, actor.id);
  } catch (err) {
    if (isUniqueConstraintError(err)) return fail({ code: [`Another item already uses the code ${input.code}.`] });
    throw err;
  }
  refresh();
  return { success: true };
}

export async function setMedicationActiveAction(formData: FormData): Promise<void> {
  const actor = await requireCatalogEditor();
  await setMedicationActive(z.uuid().parse(formData.get("id")), formData.get("isActive") === "true", actor.id);
  refresh();
}

// ------------------------------------------------------------------ import

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type MedicationImportPreviewRow = { rowNumber: number; code: string; name: string; regulatoryClass: string; action: string | null; errors: string[] };

export type MedicationImportState =
  | { stage: "error"; fileErrors: string[] }
  | { stage: "preview"; fileName: string; rows: MedicationImportPreviewRow[]; summary: ReturnType<typeof summarizeMedications> }
  | { stage: "done"; fileName: string; created: number; updated: number; skipped: number };

const importInput = z.object({
  intent: z.enum(["check", "import"]),
  source: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : null)),
  file: z
    .instanceof(File, { message: "Choose a file to upload." })
    .refine((f) => f.size > 0, "Choose a file to upload.")
    .refine((f) => f.size <= MAX_FILE_BYTES, "The file is larger than 10 MB. Split it into smaller files."),
});

/** "Check file" reads and checks every row and saves nothing; "Import"
 * re-reads and re-checks the same file (never trusting the earlier preview)
 * and saves the new and changed rows in one transaction. */
export async function medicationImportAction(_prev: MedicationImportState | null, formData: FormData): Promise<MedicationImportState> {
  const actor = await requireCatalogEditor();
  const parsed = importInput.safeParse({ intent: formData.get("intent"), source: formData.get("source") ?? undefined, file: formData.get("file") });
  if (!parsed.success) return { stage: "error", fileErrors: parsed.error.issues.map((i) => i.message) };
  const { intent, source, file } = parsed.data;

  const { rows: raw, fileErrors } = await readMedicationFile(file);
  if (fileErrors.length) return { stage: "error", fileErrors };
  if (raw.length === 0) return { stage: "error", fileErrors: ["The file has no rows under the header."] };

  const checked = checkMedicationRows(raw, await loadCatalogByCode(), source);
  const summary = summarizeMedications(checked);
  if (intent === "import" && summary.new + summary.updated > 0) {
    const { created, updated } = await commitMedicationImport(checked, file.name, actor.id);
    refresh();
    return { stage: "done", fileName: file.name, created, updated, skipped: summary.withErrors };
  }
  return {
    stage: "preview",
    fileName: file.name,
    summary,
    rows: checked.map((r) => ({
      rowNumber: r.rowNumber,
      code: (r.raw.code ?? "").toUpperCase() || "—",
      name: [r.raw.dci, r.raw.strength, r.raw.form].filter(Boolean).join(" ") || "—",
      regulatoryClass: r.input?.regulatoryClass ?? (r.raw.regulatory_class || "—"),
      action: r.action,
      errors: r.errors,
    })),
  };
}
