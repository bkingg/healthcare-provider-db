import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/enums";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { writeAudit } from "./audit";
import { REFERENCE_LIST_DEFS, type ReferenceListKey } from "@/lib/referenceListDefs";

// One generic CRUD surface over ~20 differently-shaped reference tables —
// the alternative is ~20 near-identical hand-written data modules. Zod
// validation at the action boundary (src/lib/validation/referenceLists.ts)
// is what actually keeps writes safe; this layer trusts already-parsed data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDelegate = { findMany: (args?: any) => Promise<any[]>; create: (args: any) => Promise<any>; update: (args: any) => Promise<any> };

const DELEGATES: Record<ReferenceListKey, AnyDelegate> = {
  providerTypes: prisma.providerTypeRef,
  specialties: prisma.specialty,
  languages: prisma.language,
  capabilities: prisma.capability,
  countries: prisma.countryRef,
  regions: prisma.regionRef,
  addressTypes: prisma.addressTypeRef,
  phoneTypes: prisma.phoneTypeRef,
  emailTypes: prisma.emailTypeRef,
  departments: prisma.departmentRef,
  providerTitles: prisma.providerTitleRef,
  credentialTypes: prisma.credentialTypeRef,
  credentialStatuses: prisma.credentialStatusRef,
  networks: prisma.networkRef,
  specializedNetworks: prisma.specializedNetworkRef,
  customizedClientNetworks: prisma.customizedClientNetworkRef,
  paymentTypes: prisma.paymentTypeRef,
  bankAccountTypes: prisma.bankAccountTypeRef,
  ratingScales: prisma.ratingScaleRef,
  ratingCriteria: prisma.ratingCriterionRef,
  affiliationTypes: prisma.affiliationTypeRef,
  documentCategories: prisma.documentCategoryRef,
  retentionClasses: prisma.retentionClassRef,
  serviceTypes: prisma.serviceTypeRef,
  dataQualityRules: prisma.dqRuleRef,
  medicationRequirements: prisma.medicationRequirementRef,
  medicationSettings: prisma.medicationDeliverySetting,
  memberAppFeatures: prisma.memberAppFeature,
  medicationTimeframes: prisma.medicationTimeframeRef,
  memberMessageTemplates: prisma.memberMessageTemplate,
  paymentLinks: prisma.paymentLinkRef,
  copilotTasks: prisma.copilotTaskSetting,
  copilotSettings: prisma.copilotSetting,
  userRoles: prisma.userRole,
  uiHints: prisma.uiHintRef,
  organizations: prisma.organizationRef,
  memberRelationships: prisma.memberRelationshipRef,
  caseCategories: prisma.caseCategoryRef,
  emergencyContacts: prisma.emergencyContactRef,
  responseTargets: prisma.caseResponseTarget,
  noteTemplates: prisma.caseNoteTemplateRef,
};

/** Every row, active or not — unlike referenceData.ts's listX() helpers
 * (which feed the provider-form dropdowns and filter to isActive only), the
 * admin tab is exactly where an inactive row needs to stay visible so it can
 * be edited or reactivated. */
export async function listReferenceItems(listKey: ReferenceListKey) {
  const def = REFERENCE_LIST_DEFS[listKey];
  return DELEGATES[listKey].findMany({ orderBy: def.defaultOrderBy });
}

/** Options for a `refSelect` field (e.g. ProviderTypeRef's parent, CountryRef's
 * region) — active rows only, same reasoning as referenceData.ts's listX()
 * helpers: an admin shouldn't be able to point a new/edited row at a
 * retired value. Label combines the code and primary label field so rows
 * that share a name (rare, but possible across a large list) stay distinguishable. */
export async function listReferenceOptions(listKey: ReferenceListKey): Promise<{ id: string; label: string }[]> {
  const def = REFERENCE_LIST_DEFS[listKey];
  const rows = await DELEGATES[listKey].findMany({ where: { isActive: true }, orderBy: def.defaultOrderBy });
  return rows.map((row) => ({ id: row.id, label: `${row[def.codeField.key]} — ${row[def.primaryLabelField]}` }));
}

export async function createReferenceItem(listKey: ReferenceListKey, data: Record<string, unknown>, actorId: string) {
  const def = REFERENCE_LIST_DEFS[listKey];
  const item = await DELEGATES[listKey].create({ data });
  await writeAudit({ entityType: def.model, entityId: item.id, action: AuditAction.CREATE, actorId });
  return item;
}

export async function updateReferenceItem(listKey: ReferenceListKey, id: string, data: Record<string, unknown>, actorId: string) {
  const def = REFERENCE_LIST_DEFS[listKey];
  const item = await DELEGATES[listKey].update({ where: { id }, data });
  await writeAudit({ entityType: def.model, entityId: item.id, action: AuditAction.UPDATE, actorId });
  return item;
}

/** "Inactivate"/"Reactivate" — never a hard delete, since these rows are
 * referenced from all over the provider data (a hard delete would either
 * cascade destructively or just fail on the FK). Still audit-logged as a
 * plain UPDATE (of the isActive column), not a bespoke action, since that's
 * literally what it is. */
export async function setReferenceItemActive(listKey: ReferenceListKey, id: string, isActive: boolean, actorId: string) {
  const def = REFERENCE_LIST_DEFS[listKey];
  const item = await DELEGATES[listKey].update({ where: { id }, data: { isActive } });
  await writeAudit({ entityType: def.model, entityId: item.id, action: AuditAction.UPDATE, actorId, fieldName: "isActive", newValue: String(isActive) });
  return item;
}

/** Backs the address-lookup typeahead's "autofill the country" step
 * (src/app/[locale]/providers/_components/addresses-section.tsx): looked up
 * by `iso2` first so a country Nominatim resolves twice — or one an admin
 * already added by hand through this same Value Lists screen — is reused
 * rather than duplicated (CountryRef.iso2 is `@unique`, so a duplicate
 * insert would fail anyway; this just avoids relying on that as the only
 * guard). The create is wrapped for the rare race where two address saves
 * resolve the same new country at once — the loser refetches instead of
 * erroring. */
export async function findOrCreateCountry(iso2: string, name: string, actorId: string) {
  const existing = await prisma.countryRef.findUnique({ where: { iso2 } });
  if (existing) return existing;

  try {
    const created = await prisma.countryRef.create({ data: { iso2, name } });
    await writeAudit({
      entityType: "CountryRef",
      entityId: created.id,
      action: AuditAction.CREATE,
      actorId,
      reason: "Auto-created from address lookup",
    });
    return created;
  } catch (err) {
    if (isUniqueConstraintError(err)) return prisma.countryRef.findUniqueOrThrow({ where: { iso2 } });
    throw err;
  }
}

/** Region admin's "Manage countries" dialog: reassigns CountryRef.regionId
 * for exactly the countries added/removed from this region's membership
 * (diffed against current membership, not a blind overwrite) — a country's
 * own edit form (the `region` refSelect field on the countries list) sets
 * the same column the other direction, one country at a time; this is the
 * bulk, region-centric counterpart. */
export async function setRegionCountries(regionId: string, countryIds: string[], actorId: string) {
  const current = await prisma.countryRef.findMany({ where: { regionId }, select: { id: true } });
  const currentIds = new Set(current.map((c) => c.id));
  const nextIds = new Set(countryIds);
  const toAdd = countryIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  if (toAdd.length === 0 && toRemove.length === 0) return;

  await prisma.$transaction([
    ...(toAdd.length > 0 ? [prisma.countryRef.updateMany({ where: { id: { in: toAdd } }, data: { regionId } })] : []),
    ...(toRemove.length > 0 ? [prisma.countryRef.updateMany({ where: { id: { in: toRemove } }, data: { regionId: null } })] : []),
  ]);

  for (const id of toAdd) {
    await writeAudit({ entityType: "CountryRef", entityId: id, action: AuditAction.UPDATE, actorId, fieldName: "regionId", newValue: regionId });
  }
  for (const id of toRemove) {
    await writeAudit({ entityType: "CountryRef", entityId: id, action: AuditAction.UPDATE, actorId, fieldName: "regionId", newValue: null });
  }
}
