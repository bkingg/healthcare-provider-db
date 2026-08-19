import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** One cached lookup per reference table, feeding every form's <select>
 * options from a single place. `cache()` de-dupes repeated calls within a
 * single request (e.g. a profile page rendering many sections that all need
 * countries). */

export const listCountries = cache(() => prisma.countryRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listRegions = cache(() => prisma.regionRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listProviderTypes = cache(() =>
  prisma.providerTypeRef.findMany({ where: { isActive: true }, orderBy: [{ level: "asc" }, { sortOrder: "asc" }] }),
);
export const listSpecialties = cache(() => prisma.specialty.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } }));
export const listLanguages = cache(() => prisma.language.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } }));
export const listCapabilities = cache(() => prisma.capability.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } }));
export const listAddressTypes = cache(() => prisma.addressTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listPhoneTypes = cache(() => prisma.phoneTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listEmailTypes = cache(() => prisma.emailTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listCredentialTypes = cache(() => prisma.credentialTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listCredentialStatuses = cache(() =>
  prisma.credentialStatusRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
);
export const listNetworks = cache(() => prisma.networkRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listDepartments = cache(() => prisma.departmentRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listSpecializedNetworks = cache(() =>
  prisma.specializedNetworkRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
);
export const listCustomizedClientNetworks = cache(() =>
  prisma.customizedClientNetworkRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
);
export const listRatingCriteria = cache(() => prisma.ratingCriterionRef.findMany({ where: { isActive: true } }));
export const listUiHints = cache(() => prisma.uiHintRef.findMany({ where: { isActive: true } }));
export const listProviderTitles = cache(() => prisma.providerTitleRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listPaymentTypes = cache(() => prisma.paymentTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listBankAccountTypes = cache(() =>
  prisma.bankAccountTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
);
export const listRatingScales = cache(() =>
  prisma.ratingScaleRef.findMany({ where: { isActive: true }, orderBy: { numericValue: "desc" } }),
);
export const listAffiliationTypes = cache(() =>
  prisma.affiliationTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
);
export const listDocumentCategories = cache(() =>
  prisma.documentCategoryRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
);
export const listRetentionClasses = cache(() =>
  prisma.retentionClassRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
);
export const listServiceTypes = cache(() => prisma.serviceTypeRef.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
export const listUsers = cache(() => prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
