"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { fail, type ActionResult } from "@/lib/validation/common";
import { resolveExceptionSchema } from "@/lib/validation/import";
import { assignException, resolveException } from "@/data/dataQualityExceptions";

export async function assignExceptionAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const actor = await getCurrentActor();
  await assignException(id, actor.id);
  revalidatePath("/[locale]/(staff)/exceptions", "page");
}

export async function resolveExceptionAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resolveExceptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  await resolveException(parsed.data.id, parsed.data.resolutionDecision, parsed.data.resolutionNotes, actor.id);
  revalidatePath("/[locale]/(staff)/exceptions", "page");
  return { success: true };
}
