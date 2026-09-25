"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireManageMembers } from "@/lib/rbac";
import { checkMemberRows, summarize } from "@/lib/import/memberImport";
import { commitMemberImport, loadImportRefs, readMemberFile, tooManyRows } from "@/data/memberImport";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type ImportPreviewRow = { rowNumber: number; name: string; householdId: string; role: string; errors: string[] };

export type MemberImportState =
  | { stage: "error"; fileErrors: string[] }
  | { stage: "preview"; fileName: string; rows: ImportPreviewRow[]; summary: ReturnType<typeof summarize> }
  | { stage: "done"; fileName: string; created: number; households: number; skipped: number };

const inputSchema = z.object({
  intent: z.enum(["check", "import"]),
  file: z
    .instanceof(File, { message: "Choose a file to upload." })
    .refine((f) => f.size > 0, "Choose a file to upload.")
    .refine((f) => f.size <= MAX_FILE_BYTES, "The file is larger than 5 MB. Split it into smaller files."),
});

/** One action for both buttons. "Check file" reads and checks every row and
 * returns a preview; nothing is saved. "Import" re-reads and re-checks the
 * same file (never trusting the earlier preview) and saves the rows that
 * are ready, all in one transaction. */
export async function memberImportAction(_prev: MemberImportState | null, formData: FormData): Promise<MemberImportState> {
  const actor = await getCurrentActor();
  requireManageMembers(actor);

  const parsed = inputSchema.safeParse({ intent: formData.get("intent"), file: formData.get("file") });
  if (!parsed.success) return { stage: "error", fileErrors: parsed.error.issues.map((i) => i.message) };
  const { intent, file } = parsed.data;

  const { rows: raw, fileErrors } = await readMemberFile(file);
  const limitError = tooManyRows(raw);
  if (fileErrors.length || limitError) return { stage: "error", fileErrors: [...fileErrors, ...(limitError ? [limitError] : [])] };
  if (raw.length === 0) return { stage: "error", fileErrors: ["The file has no member rows under the header."] };

  const checked = checkMemberRows(raw, await loadImportRefs());
  const summary = summarize(checked);

  if (intent === "import" && summary.ready > 0) {
    const { created, households } = await commitMemberImport(checked, file.name, actor.id);
    revalidatePath("/[locale]/(staff)/members", "layout");
    return { stage: "done", fileName: file.name, created, households, skipped: summary.withErrors };
  }

  return {
    stage: "preview",
    fileName: file.name,
    summary,
    rows: checked.map((r) => ({
      rowNumber: r.rowNumber,
      name: [r.raw.first_name, r.raw.last_name].filter(Boolean).join(" ") || "—",
      householdId: r.householdId || "—",
      role: r.isPrimary ? "PRIMARY" : (r.raw.relationship?.toUpperCase() ?? ""),
      errors: r.errors,
    })),
  };
}
