"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireWorkCases } from "@/lib/rbac";
import { fail, type ActionResult } from "@/lib/validation/common";
import { GeocodeThrottledError, GeocodeUpstreamError } from "@/lib/geocode";
import * as ops from "@/data/caseOps";

/** Every case action re-checks canWorkCases server-side — the nav link and
 * pages hide behind it too, but a form POST doesn't. */
async function requireCaseWorker() {
  const actor = await getCurrentActor();
  requireWorkCases(actor);
  return actor;
}

function refresh() {
  revalidatePath("/[locale]/(staff)/cases", "layout");
}

const id = z.uuid();
const text = (label: string) => z.string().trim().min(1, `${label} can't be empty.`).max(4000);

export async function assignCaseAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const raw = String(formData.get("assigneeId") ?? "");
  const assigneeId = raw === "ME" ? actor.id : raw ? id.parse(raw) : null;
  await ops.assignCase(caseId, assigneeId, actor.id);
  refresh();
}

export async function setCaseStatusAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const status = z.enum(["NEW", "IN_PROGRESS", "WAITING_MEMBER", "RESOLVED", "CLOSED"]).parse(formData.get("status"));
  await ops.setCaseStatus(caseId, status, actor.id);
  refresh();
}

export async function addNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ caseId: id, body: text("The note"), templateId: z.union([id, z.literal("")]).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  await ops.addInternalNote(parsed.data.caseId, parsed.data.body, actor.id, parsed.data.templateId || undefined);
  refresh();
  return { success: true };
}

export async function messageMemberAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z.object({ caseId: id, body: text("The message") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  await ops.messageMember(parsed.data.caseId, parsed.data.body, actor.id);
  refresh();
  return { success: true };
}

export async function overrideColourAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ caseId: id, rag: z.enum(["GREEN", "YELLOW", "RED"]), reason: text("The reason") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  await ops.overrideColour(parsed.data.caseId, parsed.data.rag, parsed.data.reason, actor.id);
  refresh();
  return { success: true };
}

export async function findProvidersAction(_prev: ActionResult<{ count: number; radiusKm: number }> | null, formData: FormData): Promise<ActionResult<{ count: number; radiusKm: number }>> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  try {
    const result = await ops.findProvidersForCase(caseId, actor.id);
    refresh();
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof ops.NoLocationError) return fail({ form: ["noLocation"] });
    if (err instanceof GeocodeThrottledError || err instanceof GeocodeUpstreamError) return fail({ form: ["geocodeUnavailable"] });
    throw err;
  }
}

export async function toggleProviderAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await ops.toggleProviderSelected(id.parse(formData.get("caseId")), id.parse(formData.get("providerId")), actor.id);
  refresh();
}
