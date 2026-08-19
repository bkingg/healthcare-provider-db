import "server-only";
import { formatProviderNumber } from "@/lib/providerNumber";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { AuditAction, ProviderNameKind, ProviderStatus } from "@/lib/enums";
import { buildFullNameText } from "@/lib/providerName";
import { localizedText } from "@/lib/localizedText";
import { writeAudit } from "./audit";
import type {
  CreateProviderInput,
  SetProviderStatusInput,
  UpdateProviderAvailabilityInput,
  UpdateProviderCoreInput,
  UpdateProviderNotesInput,
  UpdateProviderWebsitesInput,
} from "@/lib/validation/provider";

/** The affiliations "Related Provider" search box (affiliations-section.tsx)
 * — the server-searched combobox this replaced a plain 200-row dropdown
 * with. Same two-step raw-query-then-typed-fetch pattern as
 * searchProviders in search.ts (and the same trigram-indexed ILIKE
 * conditions, so a partial name, external ID, or the short "PROVIDERID"
 * shown throughout the UI all work), just without that function's
 * pagination/sort/filter machinery — this only ever needs a handful of
 * best-ranked matches. */
export async function searchAffiliationCandidates(query: string, excludeProviderId: string, locale: string) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const tokenConditions = tokens.map((token) => {
    const pattern = `%${token}%`;
    return Prisma.sql`(
      EXISTS (SELECT 1 FROM provider_name pn WHERE pn.provider_id = p.id AND pn.full_name_text ILIKE ${pattern})
      OR p.external_id ILIKE ${pattern}
      OR p.id::text ILIKE ${pattern}
    )`;
  });

  const matches = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM provider p
    WHERE p.id != ${excludeProviderId}::uuid
      AND (${Prisma.join(tokenConditions, " AND ")})
    ORDER BY GREATEST(
      (SELECT MAX(similarity(pn.full_name_text, ${query})) FROM provider_name pn WHERE pn.provider_id = p.id),
      COALESCE(similarity(p.external_id, ${query}), 0),
      similarity(p.id::text, ${query})
    ) DESC
    LIMIT 8
  `;
  const ids = matches.map((r) => r.id);
  if (ids.length === 0) return [];

  const rows = await prisma.provider.findMany({
    where: { id: { in: ids } },
    include: {
      names: { where: { isPrimary: true }, take: 1 },
      country: true,
      providerTypes: { where: { isPrimary: true }, include: { providerType: true }, take: 1 },
      addresses: { where: { isPrimary: true }, take: 1 },
    },
  });

  // The raw query above already ranked by similarity — findMany's `id: {in}`
  // doesn't preserve that order, so re-sort to it here.
  const rank = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  return rows.map((p) => ({
    id: p.id,
    providerCode: formatProviderNumber(p.providerNumber),
    name: p.names[0]?.fullNameText ?? p.externalId ?? p.id,
    type: localizedText(p.providerTypes[0]?.providerType.nameEn, p.providerTypes[0]?.providerType.nameFr, locale),
    city: p.addresses[0]?.city ?? null,
    country: p.country?.name ?? null,
    status: p.status,
  }));
}

export async function getProviderProfile(id: string) {
  const provider = await prisma.provider.findUnique({
    where: { id },
    include: {
      // Provider type works like specialty: to-many with one isPrimary, not
      // a single required FK — see ProviderProviderType.
      providerTypes: { include: { providerType: true }, orderBy: { isPrimary: "desc" } },
      country: { include: { region: true, qualityRating: true } },
      lastVerifiedBy: true,
      updatedBy: true,
      names: { orderBy: { isPrimary: "desc" } },
      addresses: { include: { addressType: true, country: true, updatedBy: true }, orderBy: { isPrimary: "desc" } },
      phones: { include: { phoneType: true } },
      emails: { include: { emailType: true } },
      administrativeContacts: { include: { phones: { include: { phoneType: true } }, emails: { include: { emailType: true } }, department: true } },
      specialties: { include: { specialty: true } },
      languages: { include: { language: true } },
      specializedNetworks: { include: { specializedNetwork: true } },
      customizedClientNetworks: { include: { customizedClientNetwork: true } },
      capabilities: { include: { capability: true } },
      // Postgres enums sort by declaration order, and DayOfWeek is declared
      // Monday-first (see reference.prisma), so this reads as a normal week
      // without a CASE expression to reorder it.
      officeHours: { orderBy: [{ dayOfWeek: "asc" }, { openTime: "asc" }] },
      credentials: { include: { credentialType: true, status: true, reviewedBy: true }, orderBy: { createdAt: "desc" } },
      networkContracts: { include: { network: true, approvedBy: true }, orderBy: { effectiveDate: "desc" } },
      affiliationsAsSubject: { include: { relatedProvider: { include: { names: { where: { isPrimary: true }, take: 1 } } }, affiliationType: true } },
      affiliationsAsRelated: { include: { provider: { include: { names: { where: { isPrimary: true }, take: 1 } } }, affiliationType: true } },
      bankingPayments: { include: { paymentType: true, bankAccountType: true, approvedBy: true }, orderBy: { createdAt: "desc" } },
      rates: { include: { serviceType: true, approvedBy: true }, orderBy: { effectiveDate: "desc" } },
      visits: { include: { reviewedBy: true }, orderBy: { visitDate: "desc" } },
      notes: { include: { category: true, retentionClass: true, owner: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!provider) return null;

  // The profile goes to client components, which can't receive a Prisma
  // Decimal — hand the country's rating over with a plain number instead.
  const rating = provider.country.qualityRating;
  return {
    ...provider,
    country: {
      ...provider.country,
      qualityRating: rating && { ...rating, numericValue: rating.numericValue === null ? null : Number(rating.numericValue) },
    },
  };
}

export type ProviderProfile = NonNullable<Awaited<ReturnType<typeof getProviderProfile>>>;

async function resolveTitleName(individualTitleId: string | undefined) {
  if (!individualTitleId) return undefined;
  const title = await prisma.providerTitleRef.findUnique({ where: { id: individualTitleId } });
  return title?.name;
}

export async function createProvider(input: CreateProviderInput, actorId: string) {
  const individualTitleName = await resolveTitleName(input.individualTitleId);
  const fullNameText = buildFullNameText({ ...input, individualTitleName });

  const provider = await prisma.provider.create({
    data: {
      countryId: input.countryId,
      operatingStatus: input.operatingStatus,
      nameKind: input.nameKind,
      profileSummary: input.profileSummary,
      externalId: input.externalId,
      createdBy: actorId,
      updatedById: actorId,
      names: {
        create: {
          nameType: input.nameType,
          facilityName: input.nameKind === ProviderNameKind.ENTITY ? input.facilityName : undefined,
          individualTitleId: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualTitleId : undefined,
          individualFirstName: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualFirstName : undefined,
          individualLastName: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualLastName : undefined,
          fullNameText,
          isPrimary: true,
          createdBy: actorId,
          updatedBy: actorId,
        },
      },
      // Multiple types can be picked at creation, same checkbox pattern as
      // the Clinical services tab; primaryProviderTypeId picks which one is
      // primary, defaulting to the first checked if left unset.
      providerTypes: {
        create: input.providerTypeIds.map((providerTypeId) => ({
          providerTypeId,
          isPrimary: providerTypeId === (input.primaryProviderTypeId ?? input.providerTypeIds[0]),
        })),
      },
    },
  });

  await writeAudit({
    entityType: "Provider",
    entityId: provider.id,
    action: AuditAction.CREATE,
    actorId,
    newValue: fullNameText,
  });

  return provider;
}

/** Also rewrites the primary ProviderName row's structured fields (and
 * recomputes fullNameText) whenever nameKind or the identity fields change —
 * never leaves Provider.nameKind disagreeing with what the primary name row
 * actually holds (e.g. still carrying a facilityName after switching to
 * Individual). Every other name variant on the provider is left as-is; a
 * kind change doesn't retroactively touch aliases/billing names. */
export async function updateProviderCore(input: UpdateProviderCoreInput, actorId: string) {
  const existing = await prisma.provider.findUniqueOrThrow({
    where: { id: input.id },
    include: { names: { where: { isPrimary: true }, take: 1 } },
  });

  const individualTitleName = await resolveTitleName(input.individualTitleId);
  const fullNameText = buildFullNameText({ ...input, individualTitleName });

  const provider = await prisma.$transaction(async (tx) => {
    const updated = await tx.provider.update({
      where: { id: input.id },
      data: {
        countryId: input.countryId,
        operatingStatus: input.operatingStatus,
        profileSummary: input.profileSummary,
        externalId: input.externalId,
        nameKind: input.nameKind,
        updatedById: actorId,
      },
    });

    const primaryName = existing.names[0];
    if (primaryName) {
      await tx.providerName.update({
        where: { id: primaryName.id },
        data: {
          facilityName: input.nameKind === ProviderNameKind.ENTITY ? input.facilityName : null,
          individualTitleId: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualTitleId : null,
          individualFirstName: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualFirstName : null,
          individualLastName: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualLastName : null,
          fullNameText,
          updatedBy: actorId,
        },
      });
    }

    return updated;
  });

  const trackedFields: Array<[string, unknown, unknown]> = [
    ["countryId", existing.countryId, provider.countryId],
    ["operatingStatus", existing.operatingStatus, provider.operatingStatus],
    ["externalId", existing.externalId, provider.externalId],
    ["nameKind", existing.nameKind, provider.nameKind],
  ];
  for (const [fieldName, previousValue, newValue] of trackedFields) {
    if (previousValue !== newValue) {
      await writeAudit({
        entityType: "Provider",
        entityId: provider.id,
        action: AuditAction.UPDATE,
        actorId,
        fieldName,
        previousValue: previousValue == null ? null : String(previousValue),
        newValue: newValue == null ? null : String(newValue),
      });
    }
  }

  return provider;
}

/** The "Notes" sidebar widget — Internal/External summary text, distinct
 * from the NoteAttachment collection. Not audit-logged, same as
 * profileSummary above: free-text summary fields, not identity/structural. */
export async function updateProviderNotes(input: UpdateProviderNotesInput, actorId: string) {
  return prisma.provider.update({
    where: { id: input.id },
    data: {
      internalNotes: input.internalNotes,
      externalNotes: input.externalNotes,
      updatedById: actorId,
    },
  });
}

/** The "Website" sidebar widget — same shape/reasoning as Notes above. */
export async function updateProviderWebsites(input: UpdateProviderWebsitesInput, actorId: string) {
  return prisma.provider.update({
    where: { id: input.id },
    data: {
      websiteUrl1: input.websiteUrl1,
      websiteUrl2: input.websiteUrl2,
      updatedById: actorId,
    },
  });
}

export async function updateProviderAvailability(input: UpdateProviderAvailabilityInput, actorId: string) {
  return prisma.provider.update({
    where: { id: input.id },
    data: {
      isOpen24_7: input.isOpen24_7,
      erOpen24_7: input.erOpen24_7,
      updatedById: actorId,
    },
  });
}

/** Minimum-required-profile check from the brief: Provider Name, Provider
 * Type, Active Indicator (status is always set — non-nullable enum), Country,
 * and at least one location/contact/business identifier. Country is a
 * non-nullable column so it's always satisfied once a row exists; Provider
 * Type is now a to-many assignment (like specialties — see
 * ProviderProviderType), so it can be emptied out and needs the same
 * "at least one" check as name.
 *
 * Returns ActivationGaps.* translation keys, not display strings — this is a
 * server-only data module with no access to the request locale, so callers
 * (Server or Client Components, both need it) translate at render time via
 * useTranslations/getTranslations("ActivationGaps"). */
export async function getActivationGaps(providerId: string): Promise<string[]> {
  // findUnique, not findUniqueOrThrow: this is routinely awaited in
  // Promise.all alongside a null-checked getProviderProfile() call (profile
  // page, new-provider wizard) — throwing here would turn a clean notFound()
  // into an unhandled 500 before that check ever runs.
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      names: { select: { id: true } },
      addresses: { select: { id: true } },
      phones: { select: { id: true } },
      emails: { select: { id: true } },
      providerTypes: { select: { providerTypeId: true } },
    },
  });
  if (!provider) return ["providerNotFound"];

  const gaps: string[] = [];
  if (provider.names.length === 0) gaps.push("nameRequired");
  if (provider.providerTypes.length === 0) gaps.push("providerTypeRequired");
  if (provider.addresses.length === 0 && provider.phones.length === 0 && provider.emails.length === 0) {
    gaps.push("locationOrContactRequired");
  }
  return gaps;
}

/** Bumps the provider row's updatedAt/updatedBy without touching any content
 * field — the "Last updated by ... on ..." stamp shown on every profile.
 * Provider-core mutations (updateProviderCore/Notes/Availability,
 * setProviderStatus) already update the provider row directly and don't need
 * this; every mutation to a *child* record (address, phone, credential,
 * banking, etc. — see actions.ts) calls this afterward so the stamp reflects
 * changes anywhere in the record, not just the core fields. */
export async function touchProvider(providerId: string, actorId: string) {
  await prisma.provider.update({ where: { id: providerId }, data: { updatedById: actorId } });
}

/** Manual "I checked every field on this record and it's accurate" stamp —
 * the Validate record button. Touches only lastVerifiedAt/lastVerifiedById,
 * unlike an ordinary edit, so it can't be confused with (or triggered by)
 * routine saves the way Address/ProviderName's updatedBy stamp can. */
export async function verifyProviderRecord(providerId: string, actorId: string) {
  const provider = await prisma.provider.update({
    where: { id: providerId },
    data: { lastVerifiedAt: new Date(), lastVerifiedById: actorId },
    include: { lastVerifiedBy: true },
  });

  await writeAudit({
    entityType: "Provider",
    entityId: provider.id,
    action: AuditAction.APPROVE,
    actorId,
    fieldName: "lastVerifiedAt",
    newValue: provider.lastVerifiedAt?.toISOString() ?? null,
  });

  return provider;
}

export async function setProviderStatus(input: SetProviderStatusInput, actorId: string) {
  if (input.status === ProviderStatus.ACTIVE) {
    const gaps = await getActivationGaps(input.id);
    if (gaps.length > 0) {
      return { success: false as const, gaps };
    }
  }

  const existing = await prisma.provider.findUniqueOrThrow({ where: { id: input.id } });
  const provider = await prisma.provider.update({
    where: { id: input.id },
    data: { status: input.status, updatedById: actorId },
  });

  await writeAudit({
    entityType: "Provider",
    entityId: provider.id,
    action: AuditAction.UPDATE,
    actorId,
    fieldName: "status",
    previousValue: existing.status,
    newValue: provider.status,
    reason: input.reason,
  });

  return { success: true as const, provider };
}

/** Sets the provider's 1-5 star ratings (null = not rated). */
export async function setProviderRatings(providerId: string, qualityRating: number | null, accessRating: number | null) {
  return prisma.provider.update({ where: { id: providerId }, data: { qualityRating, accessRating } });
}
