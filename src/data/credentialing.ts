import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import { writeAudit } from "./audit";
import type { AffiliationInput, CredentialInput, NetworkContractInput, UpdateNetworkContractInput } from "@/lib/validation/credentialing";

// Credential documents/status are a Phase 5 "sensitive domain" — audit-logged on create/delete.
export async function addCredential(input: CredentialInput, actorId: string) {
  const credential = await prisma.credential.create({ data: { ...input, createdBy: actorId, updatedBy: actorId } });
  await writeAudit({ entityType: "Credential", entityId: credential.id, action: AuditAction.CREATE, actorId });
  return credential;
}

export async function deleteCredential(id: string, actorId: string) {
  const credential = await prisma.credential.delete({ where: { id } });
  await writeAudit({ entityType: "Credential", entityId: credential.id, action: AuditAction.DELETE, actorId });
  return credential;
}

// Contracts are a Phase 5 "sensitive domain" — audit-logged on create/delete.
export async function addNetworkContract(input: NetworkContractInput, actorId: string) {
  const contract = await prisma.networkContract.create({ data: { ...input, createdBy: actorId, updatedBy: actorId } });
  await writeAudit({ entityType: "NetworkContract", entityId: contract.id, action: AuditAction.CREATE, actorId });
  return contract;
}

/** `?? null` on every optional column (not the bare `undefined` optionalString/
 * optionalIsoDate produce for a cleared field) — Prisma's `update()` treats
 * `undefined` as "leave this column alone," so a bare pass-through would
 * make clearing e.g. the external reference id impossible (found and fixed
 * the same bug for updateAdministrativeContact). */
export async function updateNetworkContract(input: UpdateNetworkContractInput, actorId: string) {
  const contract = await prisma.networkContract.update({
    where: { id: input.id },
    data: {
      networkId: input.networkId,
      status: input.status,
      effectiveDate: input.effectiveDate,
      endDate: input.endDate ?? null,
      terms: input.terms ?? null,
      documentUrl: input.documentUrl ?? null,
      externalReferenceId: input.externalReferenceId ?? null,
      comments: input.comments ?? null,
      updatedBy: actorId,
    },
  });
  await writeAudit({ entityType: "NetworkContract", entityId: contract.id, action: AuditAction.UPDATE, actorId });
  return contract;
}

export async function deleteNetworkContract(id: string, actorId: string) {
  const contract = await prisma.networkContract.delete({ where: { id } });
  await writeAudit({ entityType: "NetworkContract", entityId: contract.id, action: AuditAction.DELETE, actorId });
  return contract;
}

export async function addAffiliation(input: AffiliationInput, actorId: string) {
  return prisma.affiliation.create({ data: { ...input, createdBy: actorId, updatedBy: actorId } });
}

/** Changes the relationship type only (see updateAffiliationSchema) —
 * manageable from either provider's profile, since it's one relationship
 * regardless of which side's page you opened it from. */
export async function updateAffiliation(id: string, affiliationTypeId: string, actorId: string) {
  return prisma.affiliation.update({ where: { id }, data: { affiliationTypeId, updatedBy: actorId } });
}

export async function deleteAffiliation(id: string) {
  return prisma.affiliation.delete({ where: { id } });
}
