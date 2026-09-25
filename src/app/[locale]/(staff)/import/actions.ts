"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { fail, type ActionResult } from "@/lib/validation/common";
import { confirmImportBatchSchema, uploadImportBatchSchema } from "@/lib/validation/import";
import { commitImportBatch, createAndStageImportBatch } from "@/data/importBatches";

export async function uploadImportBatchAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = uploadImportBatchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  const csvText = await parsed.data.file.text();
  const batch = await createAndStageImportBatch(parsed.data.file.name, csvText, parsed.data.notes, parsed.data.aiPrompt, actor.id);

  revalidatePath("/[locale]/(staff)/import", "page");
  const locale = await getLocale();
  return redirect({ href: `/import/${batch.id}`, locale });
}

// Bound inside the "Review & confirm" dialog (see ConfirmImportDialog) rather
// than a bare button — this is the one action that writes staged rows into
// production Provider records, so it goes through the same
// useActionState-backed confirm pattern as ResolveDialog instead of a
// one-click void form action.
export async function commitImportBatchAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = confirmImportBatchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  await commitImportBatch(parsed.data.id, actor.id);
  revalidatePath(`/[locale]/(staff)/import/${parsed.data.id}`, "page");
  revalidatePath("/[locale]/(staff)/providers", "page");
  return { success: true };
}
