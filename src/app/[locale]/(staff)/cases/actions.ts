"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireWorkCases } from "@/lib/rbac";
import { fail, type ActionResult } from "@/lib/validation/common";
import { GeocodeThrottledError, GeocodeUpstreamError } from "@/lib/geocode";
import * as ops from "@/data/caseOps";
import { addAction, NotACaseWorkerError, setActionDone, type NewAction } from "@/data/caseActions";
import { parseDueInput } from "@/lib/caseActions";
import { normalizeCallbackPhone } from "@/lib/phone";
import { staffCaseFormObject, staffCaseSchema, type StaffCaseInput } from "@/lib/validation/staffCase";
import { createStaffCase, findMembersForCase, setCaseCoverage, setCaseVisibility, StaffCaseError } from "@/data/staffCases";

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

/** A next action's fields from a form (the actions panel, or the "add a
 * next action" line under the note box). Errors are message codes the
 * screen translates (Cases.actionError.*). */
function parseActionFields(formData: FormData): { ok: true; action: NewAction } | { ok: false; errors: Record<string, string[]> } {
  const title = String(formData.get("actionTitle") ?? "").trim();
  const ownerId = String(formData.get("actionOwnerId") ?? "");
  const dueAt = parseDueInput(String(formData.get("actionDue") ?? ""));
  if (!title || title.length > 200) return { ok: false, errors: { actionTitle: ["title"] } };
  if (!id.safeParse(ownerId).success) return { ok: false, errors: { actionOwnerId: ["owner"] } };
  if (!dueAt) return { ok: false, errors: { actionDue: ["due"] } };
  // A few minutes' grace for time spent typing; anything earlier is a slip.
  if (dueAt.getTime() < Date.now() - 5 * 60_000) return { ok: false, errors: { actionDue: ["duePast"] } };
  return { ok: true, action: { title, ownerId, dueAt } };
}

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
  await ops.setCaseStatus(caseId, status, actor.id, formData.get("closeOpenActions") === "1");
  refresh();
}

export async function addNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z
    .object({ caseId: id, body: text("The note"), templateId: z.union([id, z.literal("")]).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  let action: NewAction | undefined;
  if (formData.get("withAction") === "1") {
    const fields = parseActionFields(formData);
    if (!fields.ok) return fail(fields.errors);
    action = fields.action;
  }
  try {
    await ops.addInternalNote(parsed.data.caseId, parsed.data.body, actor.id, parsed.data.templateId || undefined, action);
  } catch (err) {
    if (err instanceof NotACaseWorkerError) return fail({ actionOwnerId: ["owner"] });
    throw err;
  }
  refresh();
  return { success: true };
}

export async function addCaseActionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const fields = parseActionFields(formData);
  if (!fields.ok) return fail(fields.errors);
  try {
    await addAction(caseId, fields.action, actor.id);
  } catch (err) {
    if (err instanceof NotACaseWorkerError) return fail({ actionOwnerId: ["owner"] });
    throw err;
  }
  refresh();
  return { success: true };
}

export async function setActionDoneAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await setActionDone(id.parse(formData.get("actionId")), formData.get("done") === "1", actor.id);
  refresh();
}

export async function messageMemberAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const parsed = z.object({ caseId: id, body: text("The message") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  try {
    await ops.messageMember(parsed.data.caseId, parsed.data.body, actor.id);
  } catch (err) {
    if (err instanceof ops.CaseHiddenFromMemberError) return fail({ form: ["hiddenFromMember"] });
    throw err;
  }
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

// ------------------------------------------------------------- new staff case

/** Every problem with the New case form, keyed by field ("newPerson.email",
 * "actionDue"…), as message codes the form translates. */
export async function createStaffCaseAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCaseWorker();
  const errors: Record<string, string[]> = {};
  const parsed = staffCaseSchema.safeParse(staffCaseFormObject(formData));
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path.join(".")] ??= [issue.message];

  const phone = normalizeCallbackPhone(String(formData.get("contactPhone") ?? ""), "SN");
  if (!phone) errors.contactPhone ??= ["phone"];

  let action: StaffCaseInput["action"];
  if (formData.get("withAction") === "1") {
    const fields = parseActionFields(formData);
    if (fields.ok) action = fields.action;
    else Object.assign(errors, fields.errors);
  }
  if (!parsed.success || Object.keys(errors).length) return fail(errors);

  const { colourRag, colourReason, ...form } = parsed.data;
  try {
    const created = await createStaffCase(
      { ...form, contactPhone: phone!, colour: colourRag ? { rag: colourRag, reason: colourReason ?? "" } : undefined, action },
      actor.id,
    );
    refresh();
    return { success: true, data: { id: created.id } };
  } catch (err) {
    if (err instanceof StaffCaseError) return fail({ [err.field]: [err.code] });
    if (err instanceof NotACaseWorkerError) return fail({ actionOwnerId: ["owner"] });
    throw err;
  }
}

/** Member lookup for the New case form (name, member ID, phone, email). */
export async function findMembersForCaseAction(q: string) {
  await requireCaseWorker();
  const rows = await findMembersForCase(String(q ?? "").slice(0, 100));
  return rows.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
    memberNumber: m.memberNumber,
    organization: m.organization?.name ?? null,
    isCovered: m.isCovered,
    phone: m.phone,
    email: m.email,
    household: m.household.map((h) => ({
      id: h.id,
      name: `${h.firstName} ${h.lastName}`,
      memberNumber: h.memberNumber,
      isPrimary: h.primaryMemberId === null,
      relationshipEn: h.relationship?.nameEn ?? null,
      relationshipFr: h.relationship?.nameFr ?? null,
      isCovered: h.isCovered,
      dateOfBirth: h.dateOfBirth ? h.dateOfBirth.toISOString().slice(0, 10) : null,
      phone: h.phone,
    })),
  }));
}

export type MemberMatch = Awaited<ReturnType<typeof findMembersForCaseAction>>[number];

export async function setCaseCoverageAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireCaseWorker();
  const caseId = id.parse(formData.get("caseId"));
  const coverage = z.enum(["COVERED", "SPECIAL_FREE", "SPECIAL_PAID"]).parse(formData.get("coverage"));
  try {
    await setCaseCoverage(caseId, coverage, actor.id);
  } catch (err) {
    if (err instanceof StaffCaseError) return fail({ [err.field]: [err.code] });
    throw err;
  }
  refresh();
  return { success: true };
}

export async function setCaseVisibilityAction(formData: FormData): Promise<void> {
  const actor = await requireCaseWorker();
  await setCaseVisibility(id.parse(formData.get("caseId")), formData.get("visible") === "1", actor.id);
  refresh();
}
