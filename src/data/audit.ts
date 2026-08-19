import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";

type WriteAuditInput = {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  fieldName?: string;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string;
  importBatchId?: string;
};

/** Single write path into the polymorphic AuditLog table (see Phase 1 schema
 * notes for the design tradeoff). Called from every DAL mutation that touches
 * a field the brief flags as sensitive/critical. */
export async function writeAudit(input: WriteAuditInput) {
  await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      changedById: input.actorId,
      fieldName: input.fieldName,
      previousValue: input.previousValue ?? undefined,
      newValue: input.newValue ?? undefined,
      reason: input.reason,
      importBatchId: input.importBatchId,
    },
  });
}
