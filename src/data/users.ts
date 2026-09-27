import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import { writeAudit } from "./audit";

const BCRYPT_ROUNDS = 12;

/** Every row, active or not — same reasoning as adminReferenceLists.ts's
 * listReferenceItems: a deactivated account needs to stay visible so it can
 * be edited or reactivated, not disappear from the list. */
export function listUsers() {
  return prisma.user.findMany({ include: { role: true }, orderBy: { createdAt: "desc" } });
}

/** Active roles only — options for the user create/edit form's role picker,
 * same "don't let new data point at a retired reference row" rule as every
 * other refSelect option list in this app. */
export function listActiveRoles() {
  return prisma.userRole.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

/** Not meant to be memorized — handed to the admin once to relay to the new
 * user, who changes it at their forced first login (mustChangePassword).
 * 9 random bytes -> 12 base64url characters: short enough to read/type over
 * a phone call, long enough (~72 bits) that guessing it before the user
 * changes it isn't practical. */
function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/** True when another account already uses this handle (unique index on
 * app_user.handle) — checked first so the form can say which field clashed. */
export async function isHandleTaken(handle: string, exceptUserId?: string) {
  const other = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
  return Boolean(other && other.id !== exceptUserId);
}

export async function createUser(input: { email: string; handle: string; name?: string; roleId?: string }, actorId: string) {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: input.email, handle: input.handle, name: input.name, roleId: input.roleId, passwordHash, mustChangePassword: true },
  });
  await writeAudit({ entityType: "User", entityId: user.id, action: AuditAction.CREATE, actorId });
  return { user, tempPassword };
}

export async function updateUser(id: string, input: { handle: string; name?: string; roleId?: string | null; maxSearchResults?: number | null }, actorId: string) {
  const user = await prisma.user.update({ where: { id }, data: { handle: input.handle, name: input.name, roleId: input.roleId, maxSearchResults: input.maxSearchResults } });
  await writeAudit({ entityType: "User", entityId: user.id, action: AuditAction.UPDATE, actorId });
  return user;
}

/** "Deactivate"/"Reactivate" — never a hard delete, same rule as every
 * other admin-managed table (this row is the actor on years of
 * createdBy/updatedBy/AuditLog history a hard delete would orphan or
 * cascade into). A deactivated account also can't sign in — see the
 * isActive check in src/lib/auth.ts's authorize(). */
export async function setUserActive(id: string, isActive: boolean, actorId: string) {
  const user = await prisma.user.update({ where: { id }, data: { isActive } });
  await writeAudit({ entityType: "User", entityId: user.id, action: AuditAction.UPDATE, actorId, fieldName: "isActive", newValue: String(isActive) });
  return user;
}

/** Never logs the password itself (temp or otherwise) — the audit trail
 * records that a reset happened and by whom, not the credential. */
export async function resetUserPassword(id: string, actorId: string) {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const user = await prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
  await writeAudit({
    entityType: "User",
    entityId: user.id,
    action: AuditAction.UPDATE,
    actorId,
    fieldName: "passwordHash",
    reason: "Password reset by administrator",
  });
  return { user, tempPassword };
}

/** The forced-change flow after a temp password (or a voluntary change) —
 * distinct from resetUserPassword: this is the user acting on their own
 * account, not an admin acting on someone else's. */
export async function changeOwnPassword(id: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: false } });
}
