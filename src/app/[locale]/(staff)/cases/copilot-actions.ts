"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentActor } from "@/lib/actor";
import { requireWorkCases } from "@/lib/rbac";
import { CopilotBlockedError, dismissUsage, draftReply, requireCopilot, saveSummaryAsNote, summarizeCase, type BudgetState } from "@/data/copilot";

/** The copilot buttons on the case page. Each returns text for staff to
 * review — nothing is sent or saved here, except "keep as a note", which
 * staff choose. */

export type CopilotResult =
  | { ok: true; usageId: string; text: string; test: boolean; budget: Pick<BudgetState, "warn" | "percent"> }
  | { ok: false; error: "off" | "taskOff" | "budget" | "failed" };

async function requireCopilotUser() {
  const actor = await getCurrentActor();
  requireWorkCases(actor);
  requireCopilot(actor);
  return actor;
}

const id = z.uuid();

async function guarded(fn: () => Promise<{ usageId: string; text: string; test: boolean; budget: BudgetState }>): Promise<CopilotResult> {
  try {
    const r = await fn();
    return { ok: true, usageId: r.usageId, text: r.text, test: r.test, budget: { warn: r.budget.warn, percent: r.budget.percent } };
  } catch (err) {
    if (err instanceof CopilotBlockedError) return { ok: false, error: err.reason };
    throw err;
  }
}

export async function draftReplyAction(caseId: string): Promise<CopilotResult> {
  const actor = await requireCopilotUser();
  const locale = await getLocale();
  return guarded(() => draftReply(id.parse(caseId), actor, locale));
}

export async function summarizeCaseAction(caseId: string): Promise<CopilotResult> {
  const actor = await requireCopilotUser();
  const locale = await getLocale();
  return guarded(() => summarizeCase(id.parse(caseId), actor, locale));
}

export async function saveSummaryAsNoteAction(usageId: string, caseId: string, text: string): Promise<{ ok: boolean }> {
  const actor = await requireCopilotUser();
  const body = z.string().trim().min(1).max(4000).parse(text);
  const t = await getTranslations("Copilot");
  await saveSummaryAsNote(id.parse(usageId), id.parse(caseId), body, actor.id, t("noteHeading"));
  revalidatePath("/[locale]/(staff)/cases", "layout");
  return { ok: true };
}

export async function dismissCopilotAction(usageId: string): Promise<void> {
  const actor = await requireCopilotUser();
  await dismissUsage(id.parse(usageId), actor.id);
}
