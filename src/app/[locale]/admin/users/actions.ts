"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireManageUsers } from "@/lib/rbac";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { fail, type ActionResult } from "@/lib/validation/common";
import { createUserSchema, updateUserSchema } from "@/lib/validation/users";
import * as users from "@/data/users";

function revalidateUsers() {
  revalidatePath("/[locale]/admin/users", "page");
}

/** Every mutation here re-checks canManageUsers server-side — same reasoning
 * as admin/actions.ts's requireAdmin: the nav link and page already hide
 * behind it, but a form POST doesn't. */
async function requireUserAdmin() {
  const actor = await getCurrentActor();
  requireManageUsers(actor);
  return actor;
}

export async function createUserAction(_prevState: ActionResult<{ tempPassword: string }> | null, formData: FormData): Promise<ActionResult<{ tempPassword: string }>> {
  const actor = await requireUserAdmin();
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  try {
    const { tempPassword } = await users.createUser(parsed.data, actor.id);
    revalidateUsers();
    return { success: true, data: { tempPassword } };
  } catch (err) {
    if (isUniqueConstraintError(err)) return fail({ email: [`"${parsed.data.email}" already has an account.`] });
    throw err;
  }
}

export async function updateUserAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await requireUserAdmin();
  const parsed = updateUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  await users.updateUser(parsed.data.id, { name: parsed.data.name, roleId: parsed.data.roleId ?? null, maxSearchResults: parsed.data.maxSearchResults ?? null }, actor.id);
  revalidateUsers();
  return { success: true };
}

export async function setUserActiveAction(formData: FormData): Promise<void> {
  const actor = await requireUserAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  // The UI already hides this control on the actor's own row (deactivating
  // yourself locks you out immediately — every request re-checks
  // User.isActive, see src/lib/actor.ts — with no way back in to undo it).
  // Re-checked here since a form POST doesn't hide behind the UI.
  if (id === actor.id && !isActive) return;
  await users.setUserActive(id, isActive, actor.id);
  revalidateUsers();
}

export async function resetUserPasswordAction(
  _prevState: ActionResult<{ tempPassword: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ tempPassword: string }>> {
  const actor = await requireUserAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const { tempPassword } = await users.resetUserPassword(id, actor.id);
  revalidateUsers();
  return { success: true, data: { tempPassword } };
}
