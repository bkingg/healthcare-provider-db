/**
 * Reference-data seed only. Kept separate from application migrations per the
 * working agreement — this is dev/test bootstrap data, not schema.
 * Run via `npm run db:seed` (or automatically by `prisma migrate dev`).
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_ADMIN_PASSWORD = "ChangeMe123!";

async function main() {
  // Baseline access-control roles (Phase 5) — an admin can edit their
  // permissions or add more via Admin > Value Lists > Roles afterward; this
  // just seeds the three named in the brief so there's something to assign
  // on day one.
  const [siteAdminRole] = await Promise.all([
    prisma.userRole.upsert({
      where: { code: "SITE_ADMIN" },
      update: {},
      create: {
        code: "SITE_ADMIN",
        name: "Site Administrator",
        description: "Full access: value lists, reporting, user administration, and provider record edits.",
        canEditValueLists: true,
        canViewReports: true,
        canManageUsers: true,
        canEditProviderData: true,
        canManageMembers: true,
      },
    }),
    prisma.userRole.upsert({
      where: { code: "CASE_MANAGER" },
      update: {},
      create: {
        code: "CASE_MANAGER",
        name: "Case Manager",
        description: "View-only access to provider records.",
      },
    }),
    prisma.userRole.upsert({
      where: { code: "NETWORK_MANAGER" },
      update: {},
      create: {
        code: "NETWORK_MANAGER",
        name: "Network Manager",
        description: "Can edit provider records.",
        canEditProviderData: true,
      },
    }),
  ]);

  // The one login-capable account this seed creates — assigned Site
  // Administrator so there's a way in to create every other account through
  // the Admin > Users screen. mustChangePassword forces it off this known
  // password on first login, same flow an admin-created account goes
  // through. The password/role are only set the *first* time this account
  // is created (guarded on passwordHash being unset, not folded into the
  // upsert's `update`) — re-running the seed against a DB where this admin
  // already changed their real password must never reset it back to the
  // well-known dev default.
  let systemUser = await prisma.user.upsert({
    where: { email: "system@seed.local" },
    update: {},
    create: { email: "system@seed.local", name: "Seed System User" },
  });
  if (!systemUser.passwordHash) {
    systemUser = await prisma.user.update({
      where: { id: systemUser.id },
      data: { roleId: siteAdminRole.id, passwordHash: await bcrypt.hash(DEV_ADMIN_PASSWORD, 12), mustChangePassword: true },
    });
  }

  const [westAfrica, northAmerica, westernEurope] = await Promise.all([
    prisma.regionRef.upsert({ where: { code: "WAFR" }, update: {}, create: { code: "WAFR", name: "West Africa" } }),
    prisma.regionRef.upsert({ where: { code: "NAM" }, update: {}, create: { code: "NAM", name: "North America" } }),
    prisma.regionRef.upsert({ where: { code: "WEU" }, update: {}, create: { code: "WEU", name: "Western Europe" } }),
  ]);

  const excellent = await prisma.ratingScaleRef.upsert({
    where: { code: "EXCELLENT" },
    update: {},
    create: {
      code: "EXCELLENT",
      label: "Excellent",
      numericValue: 5.0,
      descriptionEn: "Comprehensive, high-quality care is widely available, with strong facilities, workforce and referral systems.",
    },
  });
  await Promise.all(
    [
      { code: "GOOD", label: "Good", numericValue: 4.0, descriptionEn: "Generally reliable care with good coverage; some gaps in specialised services or in rural access." },
      { code: "FAIR", label: "Fair", numericValue: 3.0, descriptionEn: "Basic care is available, but quality or access is uneven, with notable gaps in services, staffing or equipment." },
      { code: "POOR", label: "Poor", numericValue: 2.0, descriptionEn: "Limited capacity and access, frequent shortages; significant care often means travelling elsewhere." },
      { code: "VERY_POOR", label: "Very poor", numericValue: 1.0, descriptionEn: "Very limited or unreliable health services, with minimal facilities and workforce." },
      { code: "UNRATED", label: "Unrated", numericValue: null, descriptionEn: "No assessment of this country's healthcare system has been made yet." },
    ].map((r) => prisma.ratingScaleRef.upsert({ where: { code: r.code }, update: {}, create: r })),
  );

  const [senegal, usa, france, nigeria, uk] = await Promise.all([
    prisma.countryRef.upsert({
      where: { iso2: "SN" },
      update: {},
      create: { name: "Senegal", iso2: "SN", regionId: westAfrica.id, qualityRatingId: excellent.id },
    }),
    prisma.countryRef.upsert({
      where: { iso2: "US" },
      update: {},
      create: { name: "United States", iso2: "US", regionId: northAmerica.id, qualityRatingId: excellent.id },
    }),
    prisma.countryRef.upsert({
      where: { iso2: "FR" },
      update: {},
      create: { name: "France", iso2: "FR", regionId: westernEurope.id, qualityRatingId: excellent.id },
    }),
    prisma.countryRef.upsert({
      where: { iso2: "NG" },
      update: {},
      create: { name: "Nigeria", iso2: "NG", regionId: westAfrica.id, qualityRatingId: excellent.id },
    }),
    prisma.countryRef.upsert({
      where: { iso2: "GB" },
      update: {},
      create: { name: "United Kingdom", iso2: "GB", regionId: westernEurope.id, qualityRatingId: excellent.id },
    }),
  ]);

  const facilityCategory = await prisma.providerTypeRef.upsert({
    where: { code: "FACILITY" },
    update: {},
    create: { level: "CATEGORY", code: "FACILITY", nameEn: "Facility", nameFr: "Établissement", sortOrder: 1 },
  });
  const practitionerCategory = await prisma.providerTypeRef.upsert({
    where: { code: "PRACTITIONER" },
    update: {},
    create: { level: "CATEGORY", code: "PRACTITIONER", nameEn: "Practitioner", nameFr: "Praticien", sortOrder: 2 },
  });
  const hospital = await prisma.providerTypeRef.upsert({
    where: { code: "HOSPITAL" },
    update: {},
    create: { level: "TYPE", code: "HOSPITAL", nameEn: "Hospital", nameFr: "Hôpital", parentId: facilityCategory.id, sortOrder: 1 },
  });
  await prisma.providerTypeRef.upsert({
    where: { code: "CLINIC" },
    update: {},
    create: { level: "TYPE", code: "CLINIC", nameEn: "Clinic", nameFr: "Clinique", parentId: facilityCategory.id, sortOrder: 2 },
  });
  await prisma.providerTypeRef.upsert({
    where: { code: "PHYSICIAN" },
    update: {},
    create: { level: "TYPE", code: "PHYSICIAN", nameEn: "Physician", nameFr: "Médecin", parentId: practitionerCategory.id, sortOrder: 1 },
  });

  const [cardiology] = await Promise.all(
    [
      { code: "CARDIOLOGY", nameEn: "Cardiology", nameFr: "Cardiologie" },
      { code: "PEDIATRICS", nameEn: "Pediatrics", nameFr: "Pédiatrie" },
      { code: "ONCOLOGY", nameEn: "Oncology", nameFr: "Oncologie" },
      { code: "ORTHOPEDICS", nameEn: "Orthopedics", nameFr: "Orthopédie" },
      { code: "GENERAL_SURGERY", nameEn: "General Surgery", nameFr: "Chirurgie générale" },
    ].map((s) => prisma.specialty.upsert({ where: { code: s.code }, update: {}, create: s })),
  );

  const [english] = await Promise.all(
    [
      { code: "EN", nameEn: "English", nameFr: "Anglais" },
      { code: "FR", nameEn: "French", nameFr: "Français" },
      { code: "WO", nameEn: "Wolof", nameFr: "Wolof" },
      { code: "PT", nameEn: "Portuguese", nameFr: "Portugais" },
      { code: "AR", nameEn: "Arabic", nameFr: "Arabe" },
    ].map((l) => prisma.language.upsert({ where: { code: l.code }, update: {}, create: l })),
  );

  const [physicalAddress] = await Promise.all(
    [
      { code: "PHYSICAL", name: "Physical" },
      { code: "MAILING", name: "Mailing" },
      { code: "BILLING", name: "Billing" },
      { code: "ADMISSIONS", name: "Admissions" },
      { code: "CLAIMS", name: "Claims" },
    ].map((a) => prisma.addressTypeRef.upsert({ where: { code: a.code }, update: {}, create: a })),
  );

  const [mainPhone] = await Promise.all(
    [
      { code: "MAIN", name: "Main" },
      { code: "EMERGENCY", name: "Emergency" },
      { code: "FAX", name: "Fax" },
      { code: "AFTER_HOURS", name: "After Hours" },
    ].map((p) => prisma.phoneTypeRef.upsert({ where: { code: p.code }, update: {}, create: p })),
  );

  const [mainEmail] = await Promise.all(
    [
      { code: "MAIN", name: "Main" },
      { code: "BILLING", name: "Billing" },
      { code: "ADMIN", name: "Administrative" },
    ].map((e) => prisma.emailTypeRef.upsert({ where: { code: e.code }, update: {}, create: e })),
  );

  await Promise.all(
    [
      { code: "MISSING_REQUIRED_FIELD", description: "A required field is missing", defaultSeverity: "CRITICAL" as const },
      { code: "INVALID_LOOKUP_VALUE", description: "Value does not map to a configured reference table entry", defaultSeverity: "ERROR" as const },
      { code: "INVALID_ACTIVE_INDICATOR", description: "Active indicator present but not recognized (expected true/false/active/inactive/1/0)", defaultSeverity: "ERROR" as const },
      { code: "MISSING_CONTACT_OR_LOCATION", description: "No address, phone, or email provided for the record", defaultSeverity: "WARNING" as const },
      { code: "INVALID_COORDINATES", description: "Latitude/longitude out of range or unconfirmed", defaultSeverity: "WARNING" as const },
      { code: "INVALID_EMAIL_FORMAT", description: "Email address is not a valid format", defaultSeverity: "WARNING" as const },
      { code: "MISSING_PHONE_TYPE", description: "Phone number provided without a recognized phone type; defaulted to Main", defaultSeverity: "INFO" as const },
      { code: "DUPLICATE_CANDIDATE", description: "Possible duplicate provider detected", defaultSeverity: "WARNING" as const },
      { code: "INVALID_BANKING_FIELD", description: "Banking field fails country/payment-type validation", defaultSeverity: "ERROR" as const },
      { code: "INVALID_DATE_RANGE", description: "End date is before the effective date", defaultSeverity: "ERROR" as const },
      { code: "MISSING_ATTACHMENT_METADATA", description: "Attachment is missing category, owner, date, visibility, or retention classification", defaultSeverity: "ERROR" as const },
    ].map((r) => prisma.dqRuleRef.upsert({ where: { code: r.code }, update: {}, create: r })),
  );

  // End-to-end smoke record so the profile view / joins are testable immediately.
  // Departments an administrative contact can belong to (admin-editable
  // afterwards from Admin > Value lists).
  await Promise.all(
    [
      { code: "BILLING", name: "Billing" },
      { code: "OPERATIONS", name: "Operations" },
      { code: "MEDICAL_RECORDS", name: "Medical Records" },
      { code: "ADMINISTRATION", name: "Administration" },
      { code: "CLINICAL", name: "Clinical" },
      { code: "HUMAN_RESOURCES", name: "Human Resources" },
      { code: "SECURITY", name: "Security" },
      { code: "LABORATORY", name: "Laboratory" },
      { code: "RADIOLOGY", name: "Radiology" },
      { code: "PHARMACY", name: "Pharmacy" },
    ].map((d) => prisma.departmentRef.upsert({ where: { code: d.code }, update: {}, create: d })),
  );

  // Hover text for the Quality / Access star ratings (admin-editable afterwards
  // from Admin > Value lists > Rating Descriptions). The app looks these two
  // rows up by code, so the codes stay fixed. French text is left for an
  // admin to fill in — never auto-translated.
  await Promise.all(
    [
      {
        code: "QUALITY",
        name: "Quality",
        descriptionEn: "How good the care or service this provider delivers is.",
        level1MeaningEn: "Poor — serious concerns about the care or service.",
        level2MeaningEn: "Below expectations — noticeable problems.",
        level3MeaningEn: "Meets expectations — acceptable, with room to improve.",
        level4MeaningEn: "Good — consistently reliable care or service.",
        level5MeaningEn: "Excellent — outstanding care or service.",
      },
      {
        code: "ACCESS",
        name: "Access",
        descriptionEn: "How easy it is for members to reach and be seen by this provider (location, hours, waiting times, availability).",
        level1MeaningEn: "Very difficult — hard to reach or be seen.",
        level2MeaningEn: "Difficult — long waits or limited availability.",
        level3MeaningEn: "Acceptable — some barriers to being seen.",
        level4MeaningEn: "Easy — short waits, good availability.",
        level5MeaningEn: "Very easy — convenient and readily available.",
      },
    ].map((r) => prisma.ratingCriterionRef.upsert({ where: { code: r.code }, update: {}, create: r })),
  );

  // Fixed-code hover/help text for UI elements (admin-editable afterwards
  // from Admin > Value lists > UI Hints). The app looks these up by code, so
  // the codes stay fixed. French text is left for an admin to fill in.
  await Promise.all(
    [
      {
        code: "VALIDATE_RECORD",
        descriptionEn: "Marks this provider record as reviewed today and confirms the current data is accurate.",
      },
    ].map((r) => prisma.uiHintRef.upsert({ where: { code: r.code }, update: {}, create: r })),
  );

  // Payment methods a provider can be paid through. Mobile money ones are
  // the wallets in common use in Senegal (admin-editable afterwards from
  // Admin > Value lists > Payment Types).
  await Promise.all(
    [
      { code: "BANK_TRANSFER", name: "Bank transfer", category: "BANK" as const },
      { code: "ORANGE_MONEY", name: "Orange Money", category: "MOBILE_MONEY" as const },
      { code: "WAVE", name: "Wave", category: "MOBILE_MONEY" as const },
      { code: "FREE_MONEY", name: "Free Money", category: "MOBILE_MONEY" as const },
      { code: "WIZALL_MONEY", name: "Wizall Money", category: "MOBILE_MONEY" as const },
      { code: "E_MONEY", name: "E-Money", category: "MOBILE_MONEY" as const },
    ].map((pt) => prisma.paymentTypeRef.upsert({ where: { code: pt.code }, update: {}, create: pt })),
  );

  const testProvider = await prisma.provider.upsert({
    where: { externalId: "SEED-TEST-0001" },
    update: {},
    create: {
      countryId: senegal.id,
      status: "ACTIVE",
      operatingStatus: "OPERATING",
      profileSummary: "Seed smoke-test hospital record.",
      externalId: "SEED-TEST-0001",
      createdBy: systemUser.id,
      updatedById: systemUser.id,
      providerTypes: {
        create: { providerTypeId: hospital.id, isPrimary: true },
      },
      names: {
        create: {
          nameType: "LEGAL",
          facilityName: "Hôpital Principal de Dakar (Seed)",
          fullNameText: "Hôpital Principal de Dakar (Seed)",
          isPrimary: true,
        },
      },
      addresses: {
        create: {
          addressTypeId: physicalAddress.id,
          line1: "1 Avenue Nelson Mandela",
          city: "Dakar",
          countryId: senegal.id,
          latitude: 14.6928,
          longitude: -17.4467,
          coordinateStatus: "CONFIRMED",
          isPrimary: true,
        },
      },
      phones: { create: { phoneTypeId: mainPhone.id, number: "+221 33 123 4567" } },
      emails: { create: { emailTypeId: mainEmail.id, address: "contact@seed-hospital.example" } },
      specialties: { create: { specialtyId: cardiology.id, isPrimary: true } },
      languages: { create: [{ languageId: english.id }] },
    },
  });

  // Nomad members (step 1.1): how a dependent relates to its primary member.
  // Admin-editable afterwards in Value lists > Member relationships.
  await Promise.all(
    [
      { code: "SPOUSE", nameEn: "Spouse", nameFr: "Conjoint(e)", sortOrder: 1 },
      { code: "CHILD", nameEn: "Child", nameFr: "Enfant", sortOrder: 2 },
      { code: "PARENT", nameEn: "Parent", nameFr: "Parent", sortOrder: 3 },
      { code: "OTHER", nameEn: "Other", nameFr: "Autre", sortOrder: 4 },
    ].map((r) => prisma.memberRelationshipRef.upsert({ where: { code: r.code }, update: {}, create: r })),
  );

  console.log("Seed complete:", { systemUser: systemUser.email, testProvider: testProvider.id, countries: [senegal, usa, france, nigeria, uk].map((c) => c.iso2) });
  console.log(`Log in as ${systemUser.email} / ${DEV_ADMIN_PASSWORD} — you'll be forced to change this password on first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
