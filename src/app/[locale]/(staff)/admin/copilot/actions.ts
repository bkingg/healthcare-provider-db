"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireEditValueLists } from "@/lib/rbac";
import { CopilotBlockedError, decideFlagSuggestion, requireCopilot, suggestCatalogFlags } from "@/data/copilot";

/** Catalog flag suggestions: asked for, applied and dismissed by someone
 * who edits the catalog. */

export type SuggestFlagsState = { ok: true; added: number; remaining: number; test: boolean; warnPercent: number | null } | { ok: false; error: "off" | "taskOff" | "budget" | "failed" } | null;

function refresh() {
  revalidatePath("/[locale]/(staff)/admin/medications", "layout");
  revalidatePath("/[locale]/(staff)/admin/copilot", "page");
}

export async function suggestFlagsAction(): Promise<SuggestFlagsState> {
  const actor = await getCurrentActor();
  requireEditValueLists(actor);
  requireCopilot(actor);
  try {
    const r = await suggestCatalogFlags(actor);
    refresh();
    return { ok: true, added: r.added, remaining: r.remaining, test: r.test, warnPercent: r.budget.warn ? r.budget.percent : null };
  } catch (err) {
    if (err instanceof CopilotBlockedError) return { ok: false, error: err.reason };
    throw err;
  }
}

export async function decideFlagAction(formData: FormData): Promise<void> {
  const actor = await getCurrentActor();
  requireEditValueLists(actor);
  const id = z.uuid().parse(formData.get("id"));
  await decideFlagSuggestion(id, formData.get("decision") === "apply", actor.id);
  refresh();
}
