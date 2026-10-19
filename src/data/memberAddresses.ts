import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import type { MemberAddressInput } from "@/lib/validation/memberAddress";
import { writeAudit } from "./audit";

/** The member's primary address — saved at quick start or from an order,
 * offered first when they order or ask for help. */

export type SavedAddress = { addressText: string; directions: string | null; latitude: number | null; longitude: number | null; updatedAt: Date; updatedBy: string | null };

export function getPrimaryAddress(memberId: string): Promise<SavedAddress | null> {
  return prisma.memberAddress.findUnique({
    where: { memberId_kind: { memberId, kind: "PRIMARY" } },
    select: { addressText: true, directions: true, latitude: true, longitude: true, updatedAt: true, updatedBy: true },
  });
}

/** Saves (or replaces) the primary address. `staffId` when staff change it
 * — then it's audited; the member's own changes aren't staff actions. */
export async function savePrimaryAddress(memberId: string, input: MemberAddressInput, staffId: string | null = null) {
  const data = { addressText: input.addressText, directions: input.directions ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, updatedBy: staffId };
  const before = await getPrimaryAddress(memberId);
  const saved = await prisma.memberAddress.upsert({
    where: { memberId_kind: { memberId, kind: "PRIMARY" } },
    create: { memberId, kind: "PRIMARY", ...data },
    update: data,
  });
  if (staffId) {
    await writeAudit({
      entityType: "MemberAddress",
      entityId: saved.id,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      actorId: staffId,
      fieldName: "primaryAddress",
      previousValue: before ? before.addressText : null,
      newValue: data.addressText,
    });
  }
  return saved;
}

export async function removePrimaryAddress(memberId: string, staffId: string | null = null) {
  const existing = await prisma.memberAddress.findUnique({ where: { memberId_kind: { memberId, kind: "PRIMARY" } } });
  if (!existing) return;
  await prisma.memberAddress.delete({ where: { id: existing.id } });
  if (staffId) await writeAudit({ entityType: "MemberAddress", entityId: existing.id, action: AuditAction.DELETE, actorId: staffId, fieldName: "primaryAddress", previousValue: existing.addressText });
}
