"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireManageMembers } from "@/lib/rbac";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { fail, type ActionResult } from "@/lib/validation/common";
import { createMemberSchema, updateMemberSchema } from "@/lib/validation/members";
import * as members from "@/data/members";
import { removePrimaryAddress, savePrimaryAddress } from "@/data/memberAddresses";
import { memberAddressSchema } from "@/lib/validation/memberAddress";
import { parseCoordinates } from "@/lib/coordinates";

function revalidateMembers() {
  revalidatePath("/[locale]/(staff)/members", "layout");
}

/** Every mutation re-checks canManageMembers server-side — the nav link and
 * pages hide behind it too, but a form POST doesn't. */
async function requireMemberAdmin() {
  const actor = await getCurrentActor();
  requireManageMembers(actor);
  return actor;
}

function handleWriteError(err: unknown, email: string | undefined): ActionResult<{ id: string }> {
  if (err instanceof members.HouseholdRuleError) return fail({ [err.field]: [err.message] });
  if (isUniqueConstraintError(err)) return fail({ email: [`"${email}" is already used by another member.`] });
  throw err;
}

export async function createMemberAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await requireMemberAdmin();
  const parsed = createMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  try {
    const member = await members.createMember(parsed.data, actor.id);
    revalidateMembers();
    return { success: true, data: { id: member.id } };
  } catch (err) {
    return handleWriteError(err, parsed.data.email);
  }
}

export async function updateMemberAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await requireMemberAdmin();
  const parsed = updateMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);
  const { id, ...input } = parsed.data;
  try {
    await members.updateMember(id, input, actor.id);
    revalidateMembers();
    return { success: true, data: { id } };
  } catch (err) {
    return handleWriteError(err, input.email);
  }
}

export async function setMemberStatusAction(formData: FormData): Promise<void> {
  const actor = await requireMemberAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const status = z.enum(["ACTIVE", "INACTIVE"]).parse(formData.get("status"));
  await members.setMemberStatus(id, status, actor.id);
  revalidateMembers();
}

// ---------------------------------------------------------- primary address

export type MemberAddressState = { ok: true } | { ok: false; error: string } | null;

/** Staff correct a member's primary address (e.g. after a courier's call).
 * Coordinates can be typed as decimals or degrees-minutes-seconds. */
export async function saveMemberAddressAction(_prev: MemberAddressState, formData: FormData): Promise<MemberAddressState> {
  const actor = await requireMemberAdmin();
  const memberId = z.uuid().safeParse(formData.get("memberId"));
  if (!memberId.success) return { ok: false, error: "invalid" };
  const coordsText = String(formData.get("coordinates") ?? "").trim();
  const point = coordsText ? parseCoordinates(coordsText) : null;
  if (coordsText && !point) return { ok: false, error: "coordinates" };
  const parsed = memberAddressSchema.safeParse({
    addressText: String(formData.get("addressText") ?? ""),
    directions: String(formData.get("directions") ?? "") || undefined,
    latitude: point?.lat,
    longitude: point?.lng,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  await savePrimaryAddress(memberId.data, parsed.data, actor.id);
  revalidateMembers();
  return { ok: true };
}

export async function removeMemberAddressAction(formData: FormData): Promise<void> {
  const actor = await requireMemberAdmin();
  await removePrimaryAddress(z.uuid().parse(formData.get("memberId")), actor.id);
  revalidateMembers();
}
