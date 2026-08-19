import "server-only";
import { prisma } from "@/lib/prisma";
import { DqStatus } from "@/lib/enums";
import type { DqResolution } from "@/lib/enums";
import type { ExceptionFilters } from "@/lib/validation/import";

export function listExceptions(filters: ExceptionFilters) {
  return prisma.dataQualityException.findMany({
    where: {
      status: filters.status,
      importBatchId: filters.importBatchId,
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    include: {
      rule: true,
      importBatch: true,
      provider: { include: { names: { where: { isPrimary: true }, take: 1 } } },
      owner: true,
      stagingRow: true,
    },
  });
}

export function listExceptionsForProvider(providerId: string) {
  return prisma.dataQualityException.findMany({
    where: { providerId, status: { not: DqStatus.RESOLVED } },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    include: { rule: true },
  });
}

export function countOpenExceptions() {
  return prisma.dataQualityException.count({ where: { status: DqStatus.OPEN } });
}

export async function assignException(id: string, actorId: string) {
  return prisma.dataQualityException.update({
    where: { id },
    data: { ownerId: actorId, status: DqStatus.ASSIGNED },
  });
}

export async function resolveException(id: string, resolutionDecision: DqResolution, resolutionNotes: string | undefined, actorId: string) {
  return prisma.dataQualityException.update({
    where: { id },
    data: {
      status: DqStatus.RESOLVED,
      resolutionDecision,
      resolutionNotes,
      resolvedAt: new Date(),
      resolvedById: actorId,
    },
  });
}
