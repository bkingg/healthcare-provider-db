import "server-only";
import { prisma } from "@/lib/prisma";
import { formatProviderNumber } from "@/lib/providerNumber";

/** Providers (facilities) a member is actively using, tagged to the case by
 * staff from Provider search or by ID. Any provider can be tagged — DO NOT
 * USE ones included, shown flagged — unlike the automatic "Find providers"
 * shortlist, which only ever offers active providers. Each change writes a
 * case_event, like every other case change. */

/** What staff see before confirming a tag typed by ID. */
export async function findProviderForTag(providerNumber: number) {
  const p = await prisma.provider.findUnique({
    where: { providerNumber },
    select: {
      id: true,
      providerNumber: true,
      status: true,
      names: { orderBy: { isPrimary: "desc" }, take: 1, select: { fullNameText: true } },
      providerTypes: { orderBy: { isPrimary: "desc" }, take: 1, select: { providerType: { select: { nameEn: true, nameFr: true } } } },
      addresses: { orderBy: { isPrimary: "desc" }, take: 1, select: { city: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    code: formatProviderNumber(p.providerNumber),
    name: p.names[0]?.fullNameText ?? formatProviderNumber(p.providerNumber),
    status: p.status,
    typeEn: p.providerTypes[0]?.providerType.nameEn ?? null,
    typeFr: p.providerTypes[0]?.providerType.nameFr ?? null,
    city: p.addresses[0]?.city ?? null,
  };
}

export async function tagProvider(caseId: string, providerId: string, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.caseProviderTag.findUnique({ where: { caseId_providerId: { caseId, providerId } } });
    if (existing) return;
    const provider = await tx.provider.findUniqueOrThrow({ where: { id: providerId }, select: { providerNumber: true } });
    await tx.caseProviderTag.create({ data: { caseId, providerId, taggedById: staffId } });
    await tx.caseEvent.create({ data: { caseId, type: "PROVIDER_TAGGED", actorType: "STAFF", staffId, data: { providerId, code: formatProviderNumber(provider.providerNumber) } } });
  });
}

export async function untagProvider(caseId: string, providerId: string, staffId: string) {
  await prisma.$transaction(async (tx) => {
    const removed = await tx.caseProviderTag.deleteMany({ where: { caseId, providerId } });
    if (!removed.count) return;
    const provider = await tx.provider.findUnique({ where: { id: providerId }, select: { providerNumber: true } });
    await tx.caseEvent.create({
      data: { caseId, type: "PROVIDER_UNTAGGED", actorType: "STAFF", staffId, data: { providerId, code: provider ? formatProviderNumber(provider.providerNumber) : null } },
    });
  });
}

/** For the tagging bar in Provider search: which case, for whom, and which
 * providers it already has. Null if the case doesn't exist. */
export async function taggingContext(caseId: string) {
  const c = await prisma.careCase.findUnique({
    where: { id: caseId },
    select: { id: true, caseNumber: true, patient: { select: { firstName: true, lastName: true } }, providerTags: { select: { providerId: true } } },
  });
  if (!c) return null;
  return { caseId: c.id, caseNumber: c.caseNumber, patient: `${c.patient.firstName} ${c.patient.lastName}`, taggedIds: c.providerTags.map((t) => t.providerId) };
}
