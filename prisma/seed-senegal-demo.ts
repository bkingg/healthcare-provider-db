/**
 * Illustrative Senegal provider dataset — kept separate from `seed.ts`
 * (core reference data + one smoke-test record, which `prisma migrate dev`
 * auto-runs on every fresh database) so this richer, optional demo content
 * doesn't run automatically on every migration. Run explicitly:
 *   npm run db:seed-demo
 *
 * Data model note ("tree structure"): a hospital's *services* are modeled as
 * Specialty (clinical fields it covers) + Capability (operational services/
 * equipment it has) tags on the hospital's own Provider record — not as
 * separate child Provider rows — since Capability's schema definition is
 * literally "facility capabilities/equipment/services/operational features."
 * A doctor either has an Affiliation row pointing at the hospital they work
 * at (STAFF_PHYSICIAN/CONSULTING_PHYSICIAN), or has none at all and carries
 * their own address/phone/email as an independent practitioner.
 *
 * Facilities are real, well-known Senegalese institutions; coordinates are
 * city-level approximations (marked coordinateStatus: UNCONFIRMED, not
 * verified precise geocodes) and phone/email are illustrative, not verified
 * real contact details. Physicians are realistic but explicitly fictional
 * names — not real practicing individuals.
 */
// Run directly via `tsx` (not through `prisma db seed`, which is reserved for
// prisma/seed.ts), so — unlike that file — this one loads .env itself.
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const systemUser = await prisma.user.upsert({
    where: { email: "system@seed.local" },
    update: {},
    create: { email: "system@seed.local", name: "Seed System User", handle: "system" },
  });

  const senegal = await prisma.countryRef.findUniqueOrThrow({ where: { iso2: "SN" } });
  const hospitalType = await prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "HOSPITAL" } });
  const clinicType = await prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "CLINIC" } });
  const physicianType = await prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "PHYSICIAN" } });
  const physicalAddress = await prisma.addressTypeRef.findUniqueOrThrow({ where: { code: "PHYSICAL" } });
  const mainPhone = await prisma.phoneTypeRef.findUniqueOrThrow({ where: { code: "MAIN" } });
  const mainEmail = await prisma.emailTypeRef.findUniqueOrThrow({ where: { code: "MAIN" } });
  const french = await prisma.language.upsert({ where: { code: "FR" }, update: {}, create: { code: "FR", nameEn: "French", nameFr: "Français" } });
  const wolof = await prisma.language.upsert({ where: { code: "WO" }, update: {}, create: { code: "WO", nameEn: "Wolof", nameFr: "Wolof" } });

  // Additional clinical specialties beyond Phase 1's starter five.
  const specialtyDefs = [
    { code: "MATERNITY", nameEn: "Maternity & Obstetrics", nameFr: "Maternité et obstétrique" },
    { code: "EMERGENCY_MEDICINE", nameEn: "Emergency Medicine", nameFr: "Médecine d'urgence" },
    { code: "RADIOLOGY", nameEn: "Radiology", nameFr: "Radiologie" },
    { code: "NEUROLOGY", nameEn: "Neurology", nameFr: "Neurologie" },
    { code: "OPHTHALMOLOGY", nameEn: "Ophthalmology", nameFr: "Ophtalmologie" },
    { code: "DERMATOLOGY", nameEn: "Dermatology", nameFr: "Dermatologie" },
    { code: "UROLOGY", nameEn: "Urology", nameFr: "Urologie" },
    { code: "ENT", nameEn: "Otolaryngology (ENT)", nameFr: "Oto-rhino-laryngologie (ORL)" },
    { code: "INTERNAL_MEDICINE", nameEn: "Internal Medicine", nameFr: "Médecine interne" },
    { code: "INFECTIOUS_DISEASE", nameEn: "Infectious Disease", nameFr: "Maladies infectieuses" },
    { code: "NEPHROLOGY", nameEn: "Nephrology", nameFr: "Néphrologie" },
  ];
  const specialties = Object.fromEntries(
    await Promise.all(
      specialtyDefs.map(async (s) => [s.code, await prisma.specialty.upsert({ where: { code: s.code }, update: {}, create: s })]),
    ),
  );
  // Pull in the Phase 1 starter specialties too so hospital assignments below can reference them.
  for (const code of ["CARDIOLOGY", "PEDIATRICS", "ONCOLOGY", "ORTHOPEDICS", "GENERAL_SURGERY"]) {
    specialties[code] = await prisma.specialty.findUniqueOrThrow({ where: { code } });
  }

  const capabilityDefs = [
    { code: "EMERGENCY_ROOM", nameEn: "Emergency Room", nameFr: "Service des urgences", category: "Operational" },
    { code: "ICU", nameEn: "Intensive Care Unit", nameFr: "Unité de soins intensifs", category: "Operational" },
    { code: "LABORATORY", nameEn: "Laboratory", nameFr: "Laboratoire", category: "Diagnostic" },
    { code: "IMAGING_RADIOLOGY", nameEn: "Imaging / Radiology", nameFr: "Imagerie / Radiologie", category: "Diagnostic" },
    { code: "BLOOD_BANK", nameEn: "Blood Bank", nameFr: "Banque du sang", category: "Operational" },
    { code: "AMBULANCE_SERVICE", nameEn: "Ambulance Service", nameFr: "Service d'ambulance", category: "Operational" },
    { code: "MATERNITY_WARD", nameEn: "Maternity Ward", nameFr: "Service de maternité", category: "Operational" },
    { code: "SURGICAL_THEATER", nameEn: "Surgical Theater", nameFr: "Bloc opératoire", category: "Operational" },
    { code: "DIALYSIS_UNIT", nameEn: "Dialysis Unit", nameFr: "Unité de dialyse", category: "Operational" },
    { code: "PHARMACY", nameEn: "Pharmacy", nameFr: "Pharmacie", category: "Operational" },
  ];
  const capabilities = Object.fromEntries(
    await Promise.all(
      capabilityDefs.map(async (c) => [c.code, await prisma.capability.upsert({ where: { code: c.code }, update: {}, create: c })]),
    ),
  );

  const staffPhysician = await prisma.affiliationTypeRef.upsert({
    where: { code: "STAFF_PHYSICIAN" },
    update: {},
    create: { code: "STAFF_PHYSICIAN", name: "Staff Physician", description: "Physician on staff at this facility" },
  });
  const consultingPhysician = await prisma.affiliationTypeRef.upsert({
    where: { code: "CONSULTING_PHYSICIAN" },
    update: {},
    create: { code: "CONSULTING_PHYSICIAN", name: "Consulting Physician", description: "Physician consults at this facility part-time" },
  });

  const hpd = await prisma.provider.findUnique({ where: { externalId: "SEED-TEST-0001" } });

  type FacilityDef = {
    externalId: string;
    name: string;
    type: typeof hospitalType;
    city: string;
    line1: string;
    latitude: number;
    longitude: number;
    phone: string;
    email: string;
    specialtyCodes: string[];
    capabilityCodes: string[];
  };

  const facilityDefs: FacilityDef[] = [
    {
      externalId: "SN-HOSP-0002",
      name: "Hôpital Aristide Le Dantec",
      type: hospitalType,
      city: "Dakar",
      line1: "Avenue Pasteur",
      latitude: 14.6673,
      longitude: -17.438,
      phone: "+221 33 889 1717",
      email: "contact@le-dantec.sn",
      specialtyCodes: ["CARDIOLOGY", "ONCOLOGY", "GENERAL_SURGERY", "INTERNAL_MEDICINE"],
      capabilityCodes: ["ICU", "LABORATORY", "IMAGING_RADIOLOGY", "SURGICAL_THEATER"],
    },
    {
      externalId: "SN-HOSP-0003",
      name: "Hôpital Général de Grand Yoff (HOGGY)",
      type: hospitalType,
      city: "Dakar",
      line1: "Grand Yoff",
      latitude: 14.7245,
      longitude: -17.4573,
      phone: "+221 33 859 1010",
      email: "contact@hoggy.sn",
      specialtyCodes: ["PEDIATRICS", "MATERNITY", "EMERGENCY_MEDICINE", "INTERNAL_MEDICINE"],
      capabilityCodes: ["EMERGENCY_ROOM", "MATERNITY_WARD", "LABORATORY", "PHARMACY"],
    },
    {
      externalId: "SN-HOSP-0004",
      name: "Hôpital Abass Ndao",
      type: hospitalType,
      city: "Dakar",
      line1: "Avenue Cheikh Anta Diop",
      latitude: 14.6953,
      longitude: -17.4497,
      phone: "+221 33 823 4041",
      email: "contact@abassndao.sn",
      specialtyCodes: ["ORTHOPEDICS", "GENERAL_SURGERY", "UROLOGY", "NEPHROLOGY"],
      capabilityCodes: ["SURGICAL_THEATER", "DIALYSIS_UNIT", "ICU", "LABORATORY"],
    },
    {
      externalId: "SN-HOSP-0005",
      name: "Hôpital Régional de Thiès",
      type: hospitalType,
      city: "Thiès",
      line1: "Route de Dakar",
      latitude: 14.791,
      longitude: -16.9256,
      phone: "+221 33 951 1015",
      email: "contact@hopital-thies.sn",
      specialtyCodes: ["MATERNITY", "PEDIATRICS", "GENERAL_SURGERY", "INTERNAL_MEDICINE"],
      capabilityCodes: ["MATERNITY_WARD", "EMERGENCY_ROOM", "LABORATORY", "BLOOD_BANK"],
    },
    {
      externalId: "SN-HOSP-0006",
      name: "Hôpital Régional de Saint-Louis",
      type: hospitalType,
      city: "Saint-Louis",
      line1: "Sor",
      latitude: 16.0179,
      longitude: -16.4896,
      phone: "+221 33 961 1015",
      email: "contact@hopital-saintlouis.sn",
      specialtyCodes: ["GENERAL_SURGERY", "INTERNAL_MEDICINE", "PEDIATRICS", "INFECTIOUS_DISEASE"],
      capabilityCodes: ["EMERGENCY_ROOM", "LABORATORY", "AMBULANCE_SERVICE", "PHARMACY"],
    },
    {
      externalId: "SN-HOSP-0007",
      name: "Hôpital de la Paix de Ziguinchor",
      type: hospitalType,
      city: "Ziguinchor",
      line1: "Boulevard du Général de Gaulle",
      latitude: 12.5556,
      longitude: -16.2719,
      phone: "+221 33 991 1015",
      email: "contact@hopitaldelapaix.sn",
      specialtyCodes: ["GENERAL_SURGERY", "PEDIATRICS", "MATERNITY", "INTERNAL_MEDICINE"],
      capabilityCodes: ["EMERGENCY_ROOM", "MATERNITY_WARD", "LABORATORY", "AMBULANCE_SERVICE"],
    },
    {
      externalId: "SN-CLIN-0001",
      name: "Clinique de la Madeleine",
      type: clinicType,
      city: "Dakar",
      line1: "Fann Résidence",
      latitude: 14.6833,
      longitude: -17.46,
      phone: "+221 33 869 1414",
      email: "contact@clinique-madeleine.sn",
      specialtyCodes: ["CARDIOLOGY", "DERMATOLOGY", "OPHTHALMOLOGY"],
      capabilityCodes: ["IMAGING_RADIOLOGY", "LABORATORY", "PHARMACY"],
    },
    {
      externalId: "SN-CLIN-0002",
      name: "Clinique Pasteur de Dakar",
      type: clinicType,
      city: "Dakar",
      line1: "Route de Ouakam",
      latitude: 14.69,
      longitude: -17.455,
      phone: "+221 33 820 5050",
      email: "contact@clinique-pasteur.sn",
      specialtyCodes: ["RADIOLOGY", "INTERNAL_MEDICINE", "CARDIOLOGY"],
      capabilityCodes: ["IMAGING_RADIOLOGY", "LABORATORY", "PHARMACY"],
    },
  ];

  const facilities: Record<string, { id: string }> = {};

  for (const def of facilityDefs) {
    const facility = await prisma.provider.upsert({
      where: { externalId: def.externalId },
      update: {},
      create: {
        countryId: senegal.id,
        status: "ACTIVE",
        operatingStatus: "OPERATING",
        externalId: def.externalId,
        createdBy: systemUser.id,
        updatedById: systemUser.id,
        providerTypes: { create: { providerTypeId: def.type.id, isPrimary: true } },
        names: { create: { nameType: "LEGAL", facilityName: def.name, fullNameText: def.name, isPrimary: true } },
        addresses: {
          create: {
            addressTypeId: physicalAddress.id,
            line1: def.line1,
            city: def.city,
            countryId: senegal.id,
            latitude: def.latitude,
            longitude: def.longitude,
            coordinateStatus: "UNCONFIRMED",
            isPrimary: true,
          },
        },
        phones: { create: { phoneTypeId: mainPhone.id, number: def.phone } },
        emails: { create: { emailTypeId: mainEmail.id, address: def.email } },
        languages: { create: [{ languageId: french.id }, { languageId: wolof.id }] },
      },
    });
    facilities[def.externalId] = facility;

    for (const [i, code] of def.specialtyCodes.entries()) {
      await prisma.providerSpecialty.upsert({
        where: { providerId_specialtyId: { providerId: facility.id, specialtyId: specialties[code].id } },
        update: {},
        create: { providerId: facility.id, specialtyId: specialties[code].id, isPrimary: i === 0 },
      });
    }
    for (const code of def.capabilityCodes) {
      await prisma.providerCapability.upsert({
        where: { providerId_capabilityId: { providerId: facility.id, capabilityId: capabilities[code].id } },
        update: {},
        create: { providerId: facility.id, capabilityId: capabilities[code].id },
      });
    }
  }

  // Enrich the pre-existing Hôpital Principal de Dakar smoke-test record with
  // the same "multiple services" treatment, without touching its identity.
  if (hpd) {
    for (const [i, code] of ["CARDIOLOGY", "GENERAL_SURGERY", "EMERGENCY_MEDICINE", "ORTHOPEDICS"].entries()) {
      await prisma.providerSpecialty.upsert({
        where: { providerId_specialtyId: { providerId: hpd.id, specialtyId: specialties[code].id } },
        update: {},
        create: { providerId: hpd.id, specialtyId: specialties[code].id, isPrimary: i === 0 },
      });
    }
    for (const code of ["EMERGENCY_ROOM", "ICU", "SURGICAL_THEATER", "BLOOD_BANK"]) {
      await prisma.providerCapability.upsert({
        where: { providerId_capabilityId: { providerId: hpd.id, capabilityId: capabilities[code].id } },
        update: {},
        create: { providerId: hpd.id, capabilityId: capabilities[code].id },
      });
    }
    facilities["SEED-TEST-0001"] = hpd;
  }

  type DoctorDef = {
    externalId: string;
    firstName: string;
    lastName: string;
    specialtyCode: string;
    phone: string;
    email: string;
    affiliation?: { facilityExternalId: string; typeId: string };
    independentAddress?: { line1: string; city: string; latitude: number; longitude: number };
  };

  const doctorDefs: DoctorDef[] = [
    {
      externalId: "SN-DOC-0001",
      firstName: "Amadou",
      lastName: "Diop",
      specialtyCode: "CARDIOLOGY",
      phone: "+221 77 100 0001",
      email: "amadou.diop@le-dantec.sn",
      affiliation: { facilityExternalId: "SN-HOSP-0002", typeId: staffPhysician.id },
    },
    {
      externalId: "SN-DOC-0002",
      firstName: "Fatou",
      lastName: "Ndiaye",
      specialtyCode: "PEDIATRICS",
      phone: "+221 77 100 0002",
      email: "fatou.ndiaye@hoggy.sn",
      affiliation: { facilityExternalId: "SN-HOSP-0003", typeId: staffPhysician.id },
    },
    {
      externalId: "SN-DOC-0003",
      firstName: "Moussa",
      lastName: "Fall",
      specialtyCode: "ORTHOPEDICS",
      phone: "+221 77 100 0003",
      email: "moussa.fall@abassndao.sn",
      affiliation: { facilityExternalId: "SN-HOSP-0004", typeId: staffPhysician.id },
    },
    {
      externalId: "SN-DOC-0004",
      firstName: "Awa",
      lastName: "Sarr",
      specialtyCode: "MATERNITY",
      phone: "+221 77 100 0004",
      email: "awa.sarr@hopital-thies.sn",
      affiliation: { facilityExternalId: "SN-HOSP-0005", typeId: staffPhysician.id },
    },
    {
      externalId: "SN-DOC-0005",
      firstName: "Ibrahima",
      lastName: "Gueye",
      specialtyCode: "GENERAL_SURGERY",
      phone: "+221 77 100 0005",
      email: "ibrahima.gueye@hopital-saintlouis.sn",
      affiliation: { facilityExternalId: "SN-HOSP-0006", typeId: staffPhysician.id },
    },
    {
      externalId: "SN-DOC-0006",
      firstName: "Aïssatou",
      lastName: "Ba",
      specialtyCode: "RADIOLOGY",
      phone: "+221 77 100 0006",
      email: "aissatou.ba@clinique-pasteur.sn",
      affiliation: { facilityExternalId: "SN-CLIN-0002", typeId: consultingPhysician.id },
    },
    {
      externalId: "SN-DOC-0007",
      firstName: "Cheikh",
      lastName: "Sow",
      specialtyCode: "DERMATOLOGY",
      phone: "+221 77 100 0007",
      email: "dr.cheikh.sow@cabinet-medical.sn",
      independentAddress: { line1: "Cabinet médical, Rue 6, Sacré-Cœur", city: "Dakar", latitude: 14.7167, longitude: -17.4667 },
    },
    {
      externalId: "SN-DOC-0008",
      firstName: "Mariama",
      lastName: "Diallo",
      specialtyCode: "ENT",
      phone: "+221 77 100 0008",
      email: "dr.mariama.diallo@cabinet-medical.sn",
      independentAddress: { line1: "Cabinet médical, Point E", city: "Dakar", latitude: 14.7031, longitude: -17.4633 },
    },
    {
      externalId: "SN-DOC-0009",
      firstName: "Ousmane",
      lastName: "Kane",
      specialtyCode: "CARDIOLOGY",
      phone: "+221 77 100 0009",
      email: "ousmane.kane@seed-hospital.example",
      affiliation: { facilityExternalId: "SEED-TEST-0001", typeId: staffPhysician.id },
    },
    {
      externalId: "SN-DOC-0010",
      firstName: "Khadija",
      lastName: "Mbaye",
      specialtyCode: "ONCOLOGY",
      phone: "+221 77 100 0010",
      email: "khadija.mbaye@le-dantec.sn",
      affiliation: { facilityExternalId: "SN-HOSP-0002", typeId: consultingPhysician.id },
    },
  ];

  for (const def of doctorDefs) {
    const fullNameText = `Dr. ${def.firstName} ${def.lastName}`;
    const doctor = await prisma.provider.upsert({
      where: { externalId: def.externalId },
      update: {},
      create: {
        countryId: senegal.id,
        status: "ACTIVE",
        operatingStatus: "OPERATING",
        externalId: def.externalId,
        createdBy: systemUser.id,
        updatedById: systemUser.id,
        providerTypes: { create: { providerTypeId: physicianType.id, isPrimary: true } },
        names: {
          create: {
            nameType: "LEGAL",
            individualFirstName: def.firstName,
            individualLastName: def.lastName,
            fullNameText,
            isPrimary: true,
          },
        },
        addresses: def.independentAddress
          ? {
              create: {
                addressTypeId: physicalAddress.id,
                line1: def.independentAddress.line1,
                city: def.independentAddress.city,
                countryId: senegal.id,
                latitude: def.independentAddress.latitude,
                longitude: def.independentAddress.longitude,
                coordinateStatus: "UNCONFIRMED",
                isPrimary: true,
              },
            }
          : undefined,
        phones: { create: { phoneTypeId: mainPhone.id, number: def.phone } },
        emails: { create: { emailTypeId: mainEmail.id, address: def.email } },
        specialties: { create: { specialtyId: specialties[def.specialtyCode].id, isPrimary: true } },
        languages: { create: [{ languageId: french.id }] },
      },
    });

    if (def.affiliation) {
      const facility = facilities[def.affiliation.facilityExternalId];
      // No natural composite unique key on Affiliation to upsert against —
      // find-then-create instead, matching the "re-running is a no-op" idempotency
      // every other seed record here gets via upsert.
      const existing = await prisma.affiliation.findFirst({
        where: { providerId: doctor.id, relatedProviderId: facility.id, affiliationTypeId: def.affiliation.typeId },
        select: { id: true },
      });
      if (!existing) {
        await prisma.affiliation.create({
          data: {
            providerId: doctor.id,
            relatedProviderId: facility.id,
            affiliationTypeId: def.affiliation.typeId,
            createdBy: systemUser.id,
            updatedBy: systemUser.id,
          },
        });
      }
    }
  }

  // Demo members (step 1.1): one group household through a demo employer
  // and one individual member, so the Members screens have realistic data.
  // Keyed on email so re-running the demo seed doesn't duplicate them.
  const demoEmployer = await prisma.organizationRef.upsert({
    where: { code: "DEMO-EMPLOYER" },
    update: {},
    create: { code: "DEMO-EMPLOYER", name: "Demo Employer SA", kind: "EMPLOYER" },
  });
  const spouse = await prisma.memberRelationshipRef.findUniqueOrThrow({ where: { code: "SPOUSE" } });
  const child = await prisma.memberRelationshipRef.findUniqueOrThrow({ where: { code: "CHILD" } });
  const primary = await prisma.member.upsert({
    where: { email: "awa.ndiaye.demo@example.com" },
    update: {},
    create: {
      firstName: "Awa", lastName: "Ndiaye", email: "awa.ndiaye.demo@example.com", phone: "+221 77 555 01 01",
      dateOfBirth: new Date("1986-04-12"), sex: "FEMALE", preferredLanguage: "fr", countryId: senegal.id, city: "Dakar",
      organizationId: demoEmployer.id, planName: "Standard", policyNumber: "DEMO-0001",
      coverageStart: new Date("2026-01-01"), coverageEnd: new Date("2026-12-31"),
      createdBy: systemUser.id, updatedBy: systemUser.id,
    },
  });
  const householdDefs = [
    { firstName: "Moussa", lastName: "Ndiaye", email: "moussa.ndiaye.demo@example.com", dateOfBirth: "1983-09-02", sex: "MALE" as const, relationshipId: spouse.id },
    { firstName: "Fatou", lastName: "Ndiaye", email: null, dateOfBirth: "2015-06-21", sex: "FEMALE" as const, relationshipId: child.id },
  ];
  for (const d of householdDefs) {
    const exists = await prisma.member.findFirst({ where: { primaryMemberId: primary.id, firstName: d.firstName } });
    if (exists) continue;
    await prisma.member.create({
      data: {
        firstName: d.firstName, lastName: d.lastName, email: d.email, dateOfBirth: new Date(d.dateOfBirth), sex: d.sex,
        preferredLanguage: "fr", countryId: senegal.id, city: "Dakar", primaryMemberId: primary.id, relationshipId: d.relationshipId,
        organizationId: demoEmployer.id, planName: "Standard", policyNumber: "DEMO-0001",
        createdBy: systemUser.id, updatedBy: systemUser.id,
      },
    });
  }
  await prisma.member.upsert({
    where: { email: "jean.diop.demo@example.com" },
    update: {},
    create: {
      firstName: "Jean", lastName: "Diop", email: "jean.diop.demo@example.com", dateOfBirth: new Date("1979-11-30"), sex: "MALE",
      preferredLanguage: "en", countryId: senegal.id, city: "Saint-Louis", createdBy: systemUser.id, updatedBy: systemUser.id,
    },
  });

  console.log("Senegal demo data seeded:", {
    facilities: facilityDefs.length + (hpd ? 1 : 0),
    physicians: doctorDefs.length,
    members: await prisma.member.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
