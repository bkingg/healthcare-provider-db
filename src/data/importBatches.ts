import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction, CoordinateStatus, DqSeverity, ImportBatchStatus, StagingValidationStatus } from "@/lib/enums";
import { geocodeIfMissing } from "@/lib/geocode";
import { writeAudit } from "./audit";
import { parseProviderCsv } from "@/lib/import/csv";
import { validateRow, type ReferenceMaps, type RowException } from "@/lib/import/validateRow";
import type { RawStagingRow } from "@/lib/import/csv";

const DUPLICATE_NAME_SIMILARITY_THRESHOLD = 0.4;

/** Bounded + no relation include: the two callers (`/import` listing, and
 * previously the app shell footer — see getLatestImportBatch below) only
 * ever show recent batches, never `loadedBy`, so this avoids an unbounded
 * table scan plus a join that's fetched but never rendered. */
export function listImportBatches() {
  return prisma.importBatch.findMany({ orderBy: { loadedAt: "desc" }, take: 50 });
}

/** The app shell footer (rendered on every route, for every request) only
 * ever needs the single most recent batch's filename/date — fetching the
 * full list there (as it used to) meant every page view scanned the whole
 * import_batch table just to read one row. */
export function getLatestImportBatch() {
  return prisma.importBatch.findFirst({
    orderBy: { loadedAt: "desc" },
    select: { fileName: true, loadedAt: true },
  });
}

export function getImportBatchDetail(id: string) {
  return prisma.importBatch.findUnique({
    where: { id },
    include: {
      loadedBy: true,
      stagingRows: {
        orderBy: { rowNumber: "asc" },
        include: {
          exceptions: {
            include: {
              rule: true,
              // Only populated for DUPLICATE_CANDIDATE exceptions (see
              // findDuplicateCandidate below) — the existing provider a
              // staged row's name fuzzy-matched against, surfaced in the
              // review/confirm dialog.
              provider: { include: { names: { where: { isPrimary: true }, take: 1 } } },
            },
          },
          matchedProvider: { include: { names: { where: { isPrimary: true }, take: 1 } } },
        },
      },
    },
  });
}

/** Upload step: creates the batch, stages every parsed row verbatim (never
 * rejecting at parse time — that's the validation step's job), then runs
 * validation immediately so the uploader sees results in one flow. */
export async function createAndStageImportBatch(
  fileName: string,
  csvText: string,
  notes: string | undefined,
  aiPrompt: string | undefined,
  actorId: string,
) {
  const { rows, errors } = parseProviderCsv(csvText);

  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      loadedById: actorId,
      totalRecordCount: rows.length,
      stagedCount: rows.length,
      status: ImportBatchStatus.VALIDATING,
      notes: [notes, ...errors].filter(Boolean).join("\n") || undefined,
      aiPrompt,
    },
  });

  if (rows.length > 0) {
    await prisma.providerStaging.createMany({
      data: rows.map((row, index) => ({ importBatchId: batch.id, rowNumber: index + 1, ...row })),
    });
  }

  await validateImportBatch(batch.id);
  return batch;
}

async function loadReferenceMaps(): Promise<ReferenceMaps> {
  const [countries, providerTypes, phoneTypes, defaultAddressType, defaultEmailType, defaultPhoneType] = await Promise.all([
    prisma.countryRef.findMany({ where: { isActive: true } }),
    prisma.providerTypeRef.findMany({ where: { isActive: true } }),
    prisma.phoneTypeRef.findMany({ where: { isActive: true } }),
    prisma.addressTypeRef.findFirst({ where: { code: "PHYSICAL" } }),
    prisma.emailTypeRef.findFirst({ where: { code: "MAIN" } }),
    prisma.phoneTypeRef.findFirst({ where: { code: "MAIN" } }),
  ]);

  if (!defaultAddressType || !defaultEmailType || !defaultPhoneType) {
    throw new Error("Seed reference data missing default address/email/phone type (PHYSICAL/MAIN/MAIN) — run `npm run db:seed`.");
  }

  return {
    countryByIso2: new Map(countries.map((c) => [c.iso2.toUpperCase(), c.id])),
    providerTypeByCode: new Map(providerTypes.map((t) => [t.code.toUpperCase(), t.id])),
    phoneTypeByCode: new Map(phoneTypes.map((t) => [t.code.toUpperCase(), t.id])),
    defaultAddressTypeId: defaultAddressType.id,
    defaultEmailTypeId: defaultEmailType.id,
    defaultPhoneTypeId: defaultPhoneType.id,
  };
}

async function findDuplicateCandidate(externalId: string | undefined, fullNameText: string, countryId: string): Promise<string | undefined> {
  if (externalId) {
    const exact = await prisma.provider.findUnique({ where: { externalId }, select: { id: true } });
    if (exact) return exact.id;
  }

  // Fuzzy name match via pg_trgm (see prisma/sql/enable-search.sql) — same
  // country, similarity above threshold. Requires that script to have run;
  // if pg_trgm isn't installed this throws, which is surfaced as a batch
  // failure rather than silently skipping duplicate detection.
  const fuzzy = await prisma.$queryRaw<{ provider_id: string }[]>`
    SELECT pn.provider_id, similarity(pn.full_name_text, ${fullNameText}) AS sim
    FROM provider_name pn
    JOIN provider p ON p.id = pn.provider_id
    WHERE p.country_id = ${countryId}::uuid
      AND similarity(pn.full_name_text, ${fullNameText}) > ${DUPLICATE_NAME_SIMILARITY_THRESHOLD}
    ORDER BY sim DESC
    LIMIT 1
  `;
  return fuzzy[0]?.provider_id;
}

export async function validateImportBatch(batchId: string) {
  const refs = await loadReferenceMaps();
  const rows = await prisma.providerStaging.findMany({
    where: { importBatchId: batchId, validationStatus: StagingValidationStatus.PENDING },
    orderBy: { rowNumber: "asc" },
  });

  let rejectedCount = 0;
  let exceptionCount = 0;

  for (const row of rows) {
    const raw: RawStagingRow = {
      rawProviderName: row.rawProviderName ?? undefined,
      rawProviderTypeCode: row.rawProviderTypeCode ?? undefined,
      rawActiveIndicator: row.rawActiveIndicator ?? undefined,
      rawCountryCode: row.rawCountryCode ?? undefined,
      rawCity: row.rawCity ?? undefined,
      rawAddressLine1: row.rawAddressLine1 ?? undefined,
      rawPhone: row.rawPhone ?? undefined,
      rawPhoneType: row.rawPhoneType ?? undefined,
      rawEmail: row.rawEmail ?? undefined,
      rawLatitude: row.rawLatitude ?? undefined,
      rawLongitude: row.rawLongitude ?? undefined,
      rawExternalId: row.rawExternalId ?? undefined,
    };

    const result = validateRow(raw, refs);
    const exceptions: RowException[] = [...result.exceptions];
    let duplicateProviderId: string | undefined;

    if (result.outcome === "VALIDATED") {
      duplicateProviderId = await findDuplicateCandidate(result.resolved.externalId, result.resolved.fullNameText, result.resolved.countryId);
      if (duplicateProviderId) {
        exceptions.push({ ruleCode: "DUPLICATE_CANDIDATE", severity: "WARNING", fieldName: "provider_name", fieldValue: result.resolved.fullNameText });
      }
    }

    if (exceptions.length > 0) {
      const rules = await prisma.dqRuleRef.findMany({ where: { code: { in: exceptions.map((e) => e.ruleCode) } } });
      const ruleByCode = new Map(rules.map((r) => [r.code, r.id]));

      await prisma.dataQualityException.createMany({
        data: exceptions.map((e) => {
          const ruleId = ruleByCode.get(e.ruleCode);
          if (!ruleId) throw new Error(`Unknown DQ rule code "${e.ruleCode}" — seed data out of sync.`);
          return {
            importBatchId: batchId,
            stagingRowId: row.id,
            providerId: duplicateProviderId,
            fieldName: e.fieldName,
            fieldValue: e.fieldValue,
            ruleId,
            severity: e.severity as DqSeverity,
          };
        }),
      });
      exceptionCount += exceptions.length;
    }

    await prisma.providerStaging.update({
      where: { id: row.id },
      data: { validationStatus: result.outcome === "REJECTED" ? StagingValidationStatus.REJECTED : StagingValidationStatus.VALIDATED },
    });
    if (result.outcome === "REJECTED") rejectedCount += 1;
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      rejectedCount: { increment: rejectedCount },
      exceptionCount: { increment: exceptionCount },
      status: rejectedCount === rows.length && rows.length > 0 ? ImportBatchStatus.FAILED : ImportBatchStatus.STAGED,
    },
  });
}

/** Commits every VALIDATED row to production tables, one transaction per row
 * so a single bad row can't roll back an entire large batch. Never touches
 * REJECTED rows. */
export async function commitImportBatch(batchId: string, actorId: string) {
  const refs = await loadReferenceMaps();
  const rows = await prisma.providerStaging.findMany({
    where: { importBatchId: batchId, validationStatus: StagingValidationStatus.VALIDATED },
    orderBy: { rowNumber: "asc" },
  });

  let approvedCount = 0;

  for (const row of rows) {
    const raw: RawStagingRow = {
      rawProviderName: row.rawProviderName ?? undefined,
      rawProviderTypeCode: row.rawProviderTypeCode ?? undefined,
      rawActiveIndicator: row.rawActiveIndicator ?? undefined,
      rawCountryCode: row.rawCountryCode ?? undefined,
      rawCity: row.rawCity ?? undefined,
      rawAddressLine1: row.rawAddressLine1 ?? undefined,
      rawPhone: row.rawPhone ?? undefined,
      rawPhoneType: row.rawPhoneType ?? undefined,
      rawEmail: row.rawEmail ?? undefined,
      rawLatitude: row.rawLatitude ?? undefined,
      rawLongitude: row.rawLongitude ?? undefined,
      rawExternalId: row.rawExternalId ?? undefined,
    };
    const result = validateRow(raw, refs);
    if (result.outcome !== "VALIDATED") continue; // shouldn't happen given the query filter; guards the type

    const { resolved } = result;

    // Rows with an address but no raw lat/long stay MISSING otherwise (see
    // validateRow.ts) — geocode them here so an import doesn't require a
    // steward to fix every address by hand afterward. Sequential + the
    // shared ~1.1s cross-request throttle in src/lib/geocode.ts means a
    // batch of many addressless rows takes proportionally longer to commit;
    // an accepted tradeoff of the free Nominatim tier, not a bug.
    let addressCoords = resolved.address;
    if (resolved.address && resolved.address.coordinateStatus === CoordinateStatus.MISSING) {
      const country = await prisma.countryRef.findUniqueOrThrow({ where: { id: resolved.address.countryId } });
      const geocoded = await geocodeIfMissing({
        line1: resolved.address.line1,
        city: resolved.address.city,
        countryName: country.name,
      });
      addressCoords = { ...resolved.address, ...geocoded };
    }

    const provider = await prisma.provider.create({
      data: {
        countryId: resolved.countryId,
        status: resolved.status,
        externalId: resolved.externalId,
        createdBy: actorId,
        updatedById: actorId,
        names: {
          create: { nameType: "LEGAL", fullNameText: resolved.fullNameText, isPrimary: true, createdBy: actorId, updatedBy: actorId },
        },
        providerTypes: {
          create: { providerTypeId: resolved.providerTypeId, isPrimary: true },
        },
        addresses: addressCoords
          ? {
              create: {
                addressTypeId: addressCoords.addressTypeId,
                line1: addressCoords.line1,
                city: addressCoords.city,
                countryId: addressCoords.countryId,
                latitude: addressCoords.latitude,
                longitude: addressCoords.longitude,
                coordinateStatus: addressCoords.coordinateStatus,
                isPrimary: true,
                createdBy: actorId,
                updatedById: actorId,
              },
            }
          : undefined,
        phones: resolved.phone
          ? { create: { phoneTypeId: resolved.phone.phoneTypeId, number: resolved.phone.number, createdBy: actorId, updatedBy: actorId } }
          : undefined,
        emails: resolved.email
          ? { create: { emailTypeId: refs.defaultEmailTypeId, address: resolved.email.address, createdBy: actorId, updatedBy: actorId } }
          : undefined,
      },
    });

    await writeAudit({
      entityType: "Provider",
      entityId: provider.id,
      action: AuditAction.CREATE,
      actorId,
      newValue: resolved.fullNameText,
      importBatchId: batchId,
    });

    await prisma.providerStaging.update({
      where: { id: row.id },
      data: { matchedProviderId: provider.id, validationStatus: StagingValidationStatus.COMMITTED },
    });
    approvedCount += 1;
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { approvedCount: { increment: approvedCount } },
  });

  await reconcileImportBatch(batchId);
}

/** Input file count vs. staged vs. approved vs. rejected vs. exceptions must
 * reconcile before a batch is considered done — the brief's explicit
 * post-load reconciliation requirement. */
export async function reconcileImportBatch(batchId: string) {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  const accountedFor = batch.approvedCount + batch.rejectedCount;

  if (accountedFor === batch.stagedCount && batch.stagedCount === batch.totalRecordCount) {
    const status =
      batch.approvedCount === 0
        ? ImportBatchStatus.REJECTED
        : batch.rejectedCount > 0
          ? ImportBatchStatus.PARTIALLY_APPROVED
          : ImportBatchStatus.APPROVED;

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status, reconciledAt: new Date() },
    });
  }
}
