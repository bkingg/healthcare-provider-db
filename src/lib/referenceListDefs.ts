/** Pure metadata for the Admin tab's generic reference-list editor — no
 * Prisma import here (unlike src/data/adminReferenceLists.ts, which maps
 * these same keys to live delegates) so this is safe for the client
 * component that renders the add/edit form fields to import directly.
 *
 * Every one of these ~20 tables is a "business taxonomy/config" reference
 * table per the rule documented at the top of prisma/schema/reference.prisma
 * — small, admin-editable value lists, as opposed to the fixed enums the
 * app's own code branches on. All of them share `id`/`isActive`/
 * `createdAt`/`updatedAt` (handled generically, not listed per field below)
 * and a unique "code" column — except CountryRef, which uses `iso2` for
 * that role instead, hence `codeField` being per-list rather than a
 * hardcoded "code" everywhere.
 *
 * `labelKey`s are translation keys under the "Admin" messages namespace
 * ("Admin.lists.<key>" for a list, "Admin.fields.<key>" for a field) —
 * reused across lists wherever the concept is the same (most fields are
 * just "name" or "description"), list-specific only where the field itself
 * is (e.g. "level", "sortOrder", "iso2").
 */

// Declared as an explicit literal-string tuple (not `keyof typeof
// REFERENCE_LIST_DEFS`) so ReferenceListKey doesn't depend on
// REFERENCE_LIST_DEFS, which itself depends on FieldDef's refSelect variant
// depending on ReferenceListKey — that cycle made every type below
// (FieldDef, ReferenceListDef, REFERENCE_LIST_DEFS) resolve to `any`.
export const REFERENCE_LIST_KEYS = [
  "providerTypes",
  "specialties",
  "languages",
  "capabilities",
  "countries",
  "regions",
  "addressTypes",
  "phoneTypes",
  "emailTypes",
  "departments",
  "providerTitles",
  "credentialTypes",
  "credentialStatuses",
  "networks",
  "specializedNetworks",
  "customizedClientNetworks",
  "paymentTypes",
  "bankAccountTypes",
  "ratingScales",
  "ratingCriteria",
  "affiliationTypes",
  "documentCategories",
  "retentionClasses",
  "serviceTypes",
  "dataQualityRules",
  "userRoles",
  "uiHints",
  "organizations",
  "memberRelationships",
  "caseCategories",
  "emergencyContacts",
  "responseTargets",
  "noteTemplates",
  "medicationRequirements",
  "medicationSettings",
  "memberAppFeatures",
  "medicationTimeframes",
  "memberMessageTemplates",
  "paymentLinks",
] as const;

export type ReferenceListKey = (typeof REFERENCE_LIST_KEYS)[number];

/** How the admin Value lists menu groups the lists, in display order, so
 * each is easy to find by what it's for. Every list belongs to exactly one
 * group — a unit test fails if a new list is added without one.
 * (ratingScales sits in Locations: it's shown nested under Countries.) */
export const REFERENCE_LIST_GROUPS = [
  { key: "memberApp", lists: ["memberAppFeatures", "caseCategories", "emergencyContacts"] },
  { key: "memberEnrollment", lists: ["organizations", "memberRelationships"] },
  { key: "caseManagement", lists: ["responseTargets", "noteTemplates"] },
  { key: "medicationDelivery", lists: ["medicationTimeframes", "memberMessageTemplates", "medicationRequirements", "medicationSettings", "paymentLinks"] },
  // Everything about provider records, ordered by theme: details, contacts,
  // networks, payments and bank details, credentials and ratings, documents
  // and data quality.
  {
    key: "providerInfo",
    lists: [
      "providerTypes", "specialties", "capabilities", "serviceTypes", "languages", "providerTitles", "affiliationTypes",
      "addressTypes", "phoneTypes", "emailTypes", "departments",
      "networks", "specializedNetworks", "customizedClientNetworks",
      "paymentTypes", "bankAccountTypes",
      "credentialTypes", "credentialStatuses", "ratingCriteria",
      "documentCategories", "retentionClasses", "dataQualityRules",
    ],
  },
  // Shared by members and providers.
  { key: "locations", lists: ["countries", "ratingScales", "regions"] },
  { key: "accessScreenText", lists: ["userRoles", "uiHints"] },
] as const satisfies readonly { key: string; lists: readonly ReferenceListKey[] }[];

export type FieldDef =
  | { key: string; labelKey: string; kind: "text"; required?: boolean }
  /** `rows` for longer text (e.g. note template bodies) — also widens the
   * add/edit dialog. */
  | { key: string; labelKey: string; kind: "textarea"; required?: boolean; rows?: number }
  | { key: string; labelKey: string; kind: "number"; required?: boolean; integer?: boolean }
  | { key: string; labelKey: string; kind: "select"; required?: boolean; options: string[] }
  | { key: string; labelKey: string; kind: "refSelect"; required?: boolean; refListKey: ReferenceListKey }
  | { key: string; labelKey: string; kind: "checkbox" }
  /** One of MAP_ICON_KEYS (src/lib/mapMarkerStyle.ts), picked from an icon
   * grid; empty = the type's built-in default. */
  | { key: string; labelKey: string; kind: "mapIcon" }
  /** A #rrggbb color, picked from recommended swatches or a custom color
   * input; empty = the type's built-in default. */
  | { key: string; labelKey: string; kind: "color" };

/** Narrows a FieldDef to its refSelect variant — a plain `f.kind ===
 * "refSelect"` inline predicate doesn't type-check against the individual
 * lists' more specific (literal-narrowed, since REFERENCE_LIST_DEFS below
 * uses `satisfies` rather than a `:` annotation) field types, so callers
 * (e.g. the admin page building refSelect options) use this helper instead. */
export function isRefSelectField(f: FieldDef): f is Extract<FieldDef, { kind: "refSelect" }> {
  return f.kind === "refSelect";
}

/** A Prisma orderBy direction, optionally with where nulls go. */
type OrderDirection = "asc" | "desc" | { sort: "asc" | "desc"; nulls?: "first" | "last" };

export type ReferenceListDef = {
  key: string;
  labelKey: string;
  /** Prisma model name — used both for audit-log entityType and (in
   * src/data/adminReferenceLists.ts) to look up the matching delegate. */
  model: string;
  codeField: { key: string; labelKey: string };
  /** Which field's value is shown as the row's main label — "name" for
   * almost everything, but RatingScaleRef calls it "label" and DqRuleRef has
   * no name at all (just "description"). */
  primaryLabelField: string;
  fields: FieldDef[];
  /** A fixed set of rows the app's code looks up by `code` (e.g. the
   * Quality/Access rating criteria): admins can edit a row's text but not add
   * rows, deactivate them, or change their code. */
  editOnly?: boolean;
  /** Form fields shown as table columns until the admin changes the
   * Columns chooser — for a value admins need at a glance (e.g. whether a
   * member app feature is on). */
  defaultColumns?: string[];
  defaultOrderBy: Record<string, OrderDirection> | Record<string, OrderDirection>[];
};

export const REFERENCE_LIST_DEFS = {
  // Nomad's standard member payment links (Wave Business, Orange Money
  // merchant) — the order screen's "Pay with…" buttons when an order has
  // no exact-amount link of its own. Off until the real links are entered.
  paymentLinks: {
    key: "paymentLinks",
    labelKey: "paymentLinks",
    model: "PaymentLinkRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "labelEn",
    fields: [
      { key: "labelEn", labelKey: "labelEn", kind: "text", required: true },
      { key: "labelFr", labelKey: "labelFr", kind: "text" },
      { key: "method", labelKey: "paymentMethod", kind: "select", required: true, options: ["WAVE", "ORANGE_MONEY", "OTHER"] },
      { key: "url", labelKey: "paymentUrl", kind: "text", required: true },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
    ],
    defaultOrderBy: [{ sortOrder: "asc" }] as Record<string, "asc" | "desc">[],
  },
  // Numbers the medication-delivery flow reads by code (quote link life,
  // waiting times, delivery estimate…): admins change values, not rows.
  medicationSettings: {
    key: "medicationSettings",
    labelKey: "medicationSettings",
    model: "MedicationDeliverySetting",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "labelEn",
    editOnly: true,
    fields: [
      { key: "labelEn", labelKey: "labelEn", kind: "text", required: true },
      { key: "labelFr", labelKey: "labelFr", kind: "text" },
      { key: "value", labelKey: "settingValue", kind: "number", integer: true, required: true },
    ],
    defaultOrderBy: [{ sortOrder: "asc" }] as Record<string, "asc" | "desc">[],
  },
  // The member's "When do you need it?" choices on a medication order. A
  // fixed set — each code sets the case urgency (colour, response time,
  // fastest vs cheapest pharmacy) — so admins change the wording, order and
  // whether it's offered, not the rows.
  medicationTimeframes: {
    key: "medicationTimeframes",
    labelKey: "medicationTimeframes",
    model: "MedicationTimeframeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "labelEn",
    editOnly: true,
    fields: [
      { key: "labelEn", labelKey: "labelEn", kind: "text", required: true },
      { key: "labelFr", labelKey: "labelFr", kind: "text" },
      { key: "helpEn", labelKey: "timeframeHelpEn", kind: "textarea", rows: 2 },
      { key: "helpFr", labelKey: "timeframeHelpFr", kind: "textarea", rows: 2 },
      { key: "isOffered", labelKey: "timeframeOffered", kind: "checkbox" },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
    ],
    defaultColumns: ["labelFr", "isOffered"],
    defaultOrderBy: [{ sortOrder: "asc" }] as Record<string, "asc" | "desc">[],
  },
  // Automatic messages posted in the member's request chat at each step of
  // a medication order. Fixed codes; admins edit the wording (EN/FR, with
  // placeholders like {total}, {eta}, {fee}) or switch one off.
  memberMessageTemplates: {
    key: "memberMessageTemplates",
    labelKey: "memberMessageTemplates",
    model: "MemberMessageTemplate",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "labelEn",
    editOnly: true,
    fields: [
      { key: "labelEn", labelKey: "labelEn", kind: "text", required: true },
      { key: "bodyFr", labelKey: "templateBodyFr", kind: "textarea", rows: 4 },
      { key: "bodyEn", labelKey: "templateBodyEn", kind: "textarea", rows: 4, required: true },
      { key: "enabled", labelKey: "templateEnabled", kind: "checkbox" },
    ],
    defaultColumns: ["bodyFr", "enabled"],
    defaultOrderBy: [{ sortOrder: "asc" }] as Record<string, "asc" | "desc">[],
  },
  // Member app services switched on or off — for covered members and for
  // members without cover (special requests) separately.
  memberAppFeatures: {
    key: "memberAppFeatures",
    labelKey: "memberAppFeatures",
    model: "MemberAppFeature",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "labelEn",
    editOnly: true,
    fields: [
      { key: "labelEn", labelKey: "labelEn", kind: "text", required: true },
      { key: "labelFr", labelKey: "labelFr", kind: "text" },
      { key: "enabled", labelKey: "featureEnabled", kind: "checkbox" },
      { key: "enabledForNotCovered", labelKey: "featureEnabledNotCovered", kind: "checkbox" },
    ],
    defaultColumns: ["enabled", "enabledForNotCovered"],
    defaultOrderBy: [{ sortOrder: "asc" }] as Record<string, "asc" | "desc">[],
  },
  // Documents and handling a medication order needs, by what's in it (see
  // prisma/schema/medication.prisma). The starting rows are suggestions for
  // Nomad's pharmacist to confirm.
  medicationRequirements: {
    key: "medicationRequirements",
    labelKey: "medicationRequirements",
    model: "MedicationRequirementRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
      { key: "appliesTo", labelKey: "requirementAppliesTo", kind: "select", required: true, options: ["PRESCRIPTION_REQUIRED", "LIST_II", "LIST_I", "NARCOTIC", "PSYCHOTROPIC", "COLD_CHAIN"] },
      { key: "kind", labelKey: "requirementKind", kind: "select", required: true, options: ["UPLOAD", "ORIGINAL_TO_COLLECT", "ID_DOCUMENT", "HANDLING"] },
      { key: "descriptionEn", labelKey: "instructionsEn", kind: "textarea", rows: 3 },
      { key: "descriptionFr", labelKey: "instructionsFr", kind: "textarea", rows: 3 },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
    ],
    defaultOrderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] as Record<string, "asc" | "desc">[],
  },
  providerTypes: {
    key: "providerTypes",
    labelKey: "providerTypes",
    model: "ProviderTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
      { key: "level", labelKey: "level", kind: "select", required: true, options: ["CATEGORY", "TYPE", "SUBTYPE", "SERVICE_GROUP"] },
      { key: "parentId", labelKey: "parent", kind: "refSelect", refListKey: "providerTypes" },
      { key: "description", labelKey: "description", kind: "textarea" },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
      { key: "mapIcon", labelKey: "mapIcon", kind: "mapIcon" },
      { key: "mapColor", labelKey: "mapColor", kind: "color" },
    ],
    defaultOrderBy: [{ level: "asc" }, { sortOrder: "asc" }] as Record<string, "asc" | "desc">[],
  },
  specialties: {
    key: "specialties",
    labelKey: "specialties",
    model: "Specialty",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
      { key: "description", labelKey: "description", kind: "textarea" },
    ],
    defaultOrderBy: { nameEn: "asc" },
  },
  languages: {
    key: "languages",
    labelKey: "languages",
    model: "Language",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
    ],
    defaultOrderBy: { nameEn: "asc" },
  },
  capabilities: {
    key: "capabilities",
    labelKey: "capabilities",
    model: "Capability",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
      { key: "category", labelKey: "category", kind: "text" },
      { key: "description", labelKey: "description", kind: "textarea" },
    ],
    defaultOrderBy: { nameEn: "asc" },
  },
  countries: {
    key: "countries",
    labelKey: "countries",
    model: "CountryRef",
    codeField: { key: "iso2", labelKey: "iso2" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "regionId", labelKey: "region", kind: "refSelect", refListKey: "regions" },
      { key: "qualityRatingId", labelKey: "qualityRating", kind: "refSelect", refListKey: "ratingScales" },
    ],
    defaultOrderBy: { name: "asc" },
  },
  regions: {
    key: "regions",
    labelKey: "regions",
    model: "RegionRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  addressTypes: {
    key: "addressTypes",
    labelKey: "addressTypes",
    model: "AddressTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  phoneTypes: {
    key: "phoneTypes",
    labelKey: "phoneTypes",
    model: "PhoneTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  emailTypes: {
    key: "emailTypes",
    labelKey: "emailTypes",
    model: "EmailTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  departments: {
    key: "departments",
    labelKey: "departments",
    model: "DepartmentRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  providerTitles: {
    key: "providerTitles",
    labelKey: "providerTitles",
    model: "ProviderTitleRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  specializedNetworks: {
    key: "specializedNetworks",
    labelKey: "specializedNetworks",
    model: "SpecializedNetworkRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  customizedClientNetworks: {
    key: "customizedClientNetworks",
    labelKey: "customizedClientNetworks",
    model: "CustomizedClientNetworkRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  credentialTypes: {
    key: "credentialTypes",
    labelKey: "credentialTypes",
    model: "CredentialTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "description", labelKey: "description", kind: "textarea" },
    ],
    defaultOrderBy: { name: "asc" },
  },
  credentialStatuses: {
    key: "credentialStatuses",
    labelKey: "credentialStatuses",
    model: "CredentialStatusRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "description", labelKey: "description", kind: "textarea" },
    ],
    defaultOrderBy: { name: "asc" },
  },
  networks: {
    key: "networks",
    labelKey: "networks",
    model: "NetworkRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "description", labelKey: "description", kind: "textarea" },
    ],
    defaultOrderBy: { name: "asc" },
  },
  paymentTypes: {
    key: "paymentTypes",
    labelKey: "paymentTypes",
    model: "PaymentTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "category", labelKey: "paymentCategory", kind: "select", required: true, options: ["BANK", "MOBILE_MONEY"] },
    ],
    defaultOrderBy: { name: "asc" },
  },
  bankAccountTypes: {
    key: "bankAccountTypes",
    labelKey: "bankAccountTypes",
    model: "BankAccountTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  ratingScales: {
    key: "ratingScales",
    labelKey: "ratingScales",
    model: "RatingScaleRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "label",
    fields: [
      { key: "label", labelKey: "label", kind: "text", required: true },
      { key: "numericValue", labelKey: "numericValue", kind: "number" },
      { key: "descriptionEn", labelKey: "descriptionEn", kind: "textarea" },
      { key: "descriptionFr", labelKey: "descriptionFr", kind: "textarea" },
    ],
    // Highest rating first (5 down to 1), "Unrated" (no number) last.
    defaultOrderBy: { numericValue: { sort: "desc", nulls: "last" } },
  },
  ratingCriteria: {
    key: "ratingCriteria",
    labelKey: "ratingCriteria",
    model: "RatingCriterionRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    editOnly: true,
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "descriptionEn", labelKey: "ratingDescriptionEn", kind: "textarea" },
      { key: "descriptionFr", labelKey: "ratingDescriptionFr", kind: "textarea" },
      { key: "level1MeaningEn", labelKey: "level1MeaningEn", kind: "textarea" },
      { key: "level1MeaningFr", labelKey: "level1MeaningFr", kind: "textarea" },
      { key: "level2MeaningEn", labelKey: "level2MeaningEn", kind: "textarea" },
      { key: "level2MeaningFr", labelKey: "level2MeaningFr", kind: "textarea" },
      { key: "level3MeaningEn", labelKey: "level3MeaningEn", kind: "textarea" },
      { key: "level3MeaningFr", labelKey: "level3MeaningFr", kind: "textarea" },
      { key: "level4MeaningEn", labelKey: "level4MeaningEn", kind: "textarea" },
      { key: "level4MeaningFr", labelKey: "level4MeaningFr", kind: "textarea" },
      { key: "level5MeaningEn", labelKey: "level5MeaningEn", kind: "textarea" },
      { key: "level5MeaningFr", labelKey: "level5MeaningFr", kind: "textarea" },
    ],
    defaultOrderBy: { code: "asc" },
  },
  affiliationTypes: {
    key: "affiliationTypes",
    labelKey: "affiliationTypes",
    model: "AffiliationTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "description", labelKey: "description", kind: "textarea" },
    ],
    defaultOrderBy: { name: "asc" },
  },
  documentCategories: {
    key: "documentCategories",
    labelKey: "documentCategories",
    model: "DocumentCategoryRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [{ key: "name", labelKey: "name", kind: "text", required: true }],
    defaultOrderBy: { name: "asc" },
  },
  retentionClasses: {
    key: "retentionClasses",
    labelKey: "retentionClasses",
    model: "RetentionClassRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "retentionPeriodMonths", labelKey: "retentionPeriodMonths", kind: "number", integer: true },
    ],
    defaultOrderBy: { name: "asc" },
  },
  serviceTypes: {
    key: "serviceTypes",
    labelKey: "serviceTypes",
    model: "ServiceTypeRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "description", labelKey: "description", kind: "textarea" },
    ],
    defaultOrderBy: { name: "asc" },
  },
  dataQualityRules: {
    key: "dataQualityRules",
    labelKey: "dataQualityRules",
    model: "DqRuleRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "description",
    fields: [
      { key: "description", labelKey: "description", kind: "textarea", required: true },
      { key: "defaultSeverity", labelKey: "defaultSeverity", kind: "select", required: true, options: ["INFO", "WARNING", "ERROR", "CRITICAL"] },
    ],
    defaultOrderBy: { code: "asc" },
  },
  userRoles: {
    key: "userRoles",
    labelKey: "userRoles",
    model: "UserRole",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "description", labelKey: "description", kind: "textarea" },
      { key: "canEditValueLists", labelKey: "canEditValueLists", kind: "checkbox" },
      { key: "canViewReports", labelKey: "canViewReports", kind: "checkbox" },
      { key: "canManageUsers", labelKey: "canManageUsers", kind: "checkbox" },
      { key: "canEditProviderData", labelKey: "canEditProviderData", kind: "checkbox" },
      { key: "canManageMembers", labelKey: "canManageMembers", kind: "checkbox" },
      { key: "canWorkCases", labelKey: "canWorkCases", kind: "checkbox" },
      { key: "maxSearchResults", labelKey: "maxSearchResults", kind: "number", integer: true },
    ],
    defaultOrderBy: { name: "asc" },
  },
  organizations: {
    key: "organizations",
    labelKey: "organizations",
    model: "OrganizationRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "name",
    fields: [
      { key: "name", labelKey: "name", kind: "text", required: true },
      { key: "kind", labelKey: "organizationKind", kind: "select", required: true, options: ["EMPLOYER", "INSURER", "OTHER"] },
    ],
    defaultOrderBy: { name: "asc" },
  },
  memberRelationships: {
    key: "memberRelationships",
    labelKey: "memberRelationships",
    model: "MemberRelationshipRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
    ],
    defaultOrderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] as Record<string, "asc" | "desc">[],
  },
  caseCategories: {
    key: "caseCategories",
    labelKey: "caseCategories",
    model: "CaseCategoryRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
    ],
    defaultOrderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] as Record<string, "asc" | "desc">[],
  },
  emergencyContacts: {
    key: "emergencyContacts",
    labelKey: "emergencyContacts",
    model: "EmergencyContactRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "labelEn",
    fields: [
      { key: "labelEn", labelKey: "labelEn", kind: "text", required: true },
      { key: "labelFr", labelKey: "labelFr", kind: "text" },
      { key: "phone", labelKey: "phone", kind: "text", required: true },
      { key: "kind", labelKey: "emergencyContactKind", kind: "select", required: true, options: ["PUBLIC", "PRIVATE_EMS", "NOMAD"] },
      { key: "countryId", labelKey: "country", kind: "refSelect", refListKey: "countries" },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
    ],
    defaultOrderBy: [{ sortOrder: "asc" }, { labelEn: "asc" }] as Record<string, "asc" | "desc">[],
  },
  // One fixed row per colour (RED / YELLOW / GREEN), looked up by code — so
  // admins edit the times but can't add, rename or remove a colour.
  responseTargets: {
    key: "responseTargets",
    labelKey: "responseTargets",
    model: "CaseResponseTarget",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "labelEn",
    editOnly: true,
    fields: [
      { key: "labelEn", labelKey: "labelEn", kind: "text", required: true },
      { key: "labelFr", labelKey: "labelFr", kind: "text" },
      { key: "minutes", labelKey: "responseMinutes", kind: "number", integer: true, required: true },
      { key: "businessHoursOnly", labelKey: "businessHoursOnly", kind: "checkbox" },
    ],
    defaultOrderBy: { minutes: "asc" },
  },
  noteTemplates: {
    key: "noteTemplates",
    labelKey: "noteTemplates",
    model: "CaseNoteTemplateRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "nameEn",
    fields: [
      { key: "nameEn", labelKey: "nameEn", kind: "text", required: true },
      { key: "nameFr", labelKey: "nameFr", kind: "text" },
      { key: "bodyEn", labelKey: "templateBodyEn", kind: "textarea", rows: 14 },
      { key: "bodyFr", labelKey: "templateBodyFr", kind: "textarea", rows: 14 },
      { key: "sortOrder", labelKey: "sortOrder", kind: "number", integer: true },
    ],
    defaultOrderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] as Record<string, "asc" | "desc">[],
  },
  uiHints: {
    key: "uiHints",
    labelKey: "uiHints",
    model: "UiHintRef",
    codeField: { key: "code", labelKey: "code" },
    primaryLabelField: "descriptionEn",
    editOnly: true,
    fields: [
      { key: "descriptionEn", labelKey: "descriptionEn", kind: "textarea", required: true },
      { key: "descriptionFr", labelKey: "descriptionFr", kind: "textarea" },
    ],
    defaultOrderBy: { code: "asc" },
  },
} satisfies Record<ReferenceListKey, ReferenceListDef>;
