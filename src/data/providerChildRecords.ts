import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction, ProviderNameKind } from "@/lib/enums";
import { buildFullNameText } from "@/lib/providerName";
import { geocodeIfMissing } from "@/lib/geocode";
import { writeAudit } from "./audit";
import type {
  AddressInput,
  AdministrativeContactEmailInput,
  AdministrativeContactInput,
  AdministrativeContactPhoneInput,
  EmailInput,
  OfficeHoursBatchInput,
  PhoneInput,
  ProviderNameInput,
  UpdateAddressInput,
  UpdateAdministrativeContactInput,
} from "@/lib/validation/provider";

/** Shared by addAddress/updateAddress: resolves the country name
 * `geocodeIfMissing` needs for its query text, then defers to it for the
 * actual latitude/longitude/coordinateStatus — the form's own
 * `coordinateStatus` field (always MISSING by default; see addressSchema)
 * is never trusted directly, since whether a location is geocoded or
 * manually entered is determined here, not by the client. */
async function resolveAddressCoordinates(input: {
  line1: string;
  city: string;
  stateProvince?: string;
  postalCode?: string;
  countryId: string;
  latitude?: number;
  longitude?: number;
}) {
  const country = await prisma.countryRef.findUniqueOrThrow({ where: { id: input.countryId } });
  return geocodeIfMissing({
    line1: input.line1,
    city: input.city,
    stateProvince: input.stateProvince,
    postalCode: input.postalCode,
    countryName: country.name,
    latitude: input.latitude,
    longitude: input.longitude,
  });
}

export async function addProviderName(input: ProviderNameInput, actorId: string) {
  const individualTitleName = input.individualTitleId
    ? (await prisma.providerTitleRef.findUnique({ where: { id: input.individualTitleId } }))?.name
    : undefined;
  const fullNameText = buildFullNameText({ ...input, individualTitleName });

  const name = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.providerName.updateMany({ where: { providerId: input.providerId }, data: { isPrimary: false } });
    }
    return tx.providerName.create({
      data: {
        providerId: input.providerId,
        nameType: input.nameType,
        facilityName: input.nameKind === ProviderNameKind.ENTITY ? input.facilityName : undefined,
        individualTitleId: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualTitleId : undefined,
        individualFirstName: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualFirstName : undefined,
        individualMiddleName: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualMiddleName : undefined,
        individualLastName: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualLastName : undefined,
        individualSuffix: input.nameKind === ProviderNameKind.INDIVIDUAL ? input.individualSuffix : undefined,
        fullNameText,
        isPrimary: input.isPrimary,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
  });

  await writeAudit({ entityType: "ProviderName", entityId: name.id, action: AuditAction.CREATE, actorId, newValue: name.fullNameText });
  return name;
}

export async function deleteProviderName(id: string, actorId: string) {
  const name = await prisma.providerName.delete({ where: { id } });
  await writeAudit({ entityType: "ProviderName", entityId: name.id, action: AuditAction.DELETE, actorId, previousValue: name.fullNameText });
  return name;
}

export async function addAddress(input: AddressInput, actorId: string) {
  const { latitude, longitude, coordinateStatus } = await resolveAddressCoordinates(input);

  const address = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.address.updateMany({ where: { providerId: input.providerId }, data: { isPrimary: false } });
    }
    return tx.address.create({
      data: { ...input, latitude, longitude, coordinateStatus, createdBy: actorId, updatedById: actorId },
    });
  });

  await writeAudit({ entityType: "Address", entityId: address.id, action: AuditAction.CREATE, actorId, newValue: address.line1 });
  return address;
}

/** The only edit path for an address — fills the gap where previously only
 * add/delete existed. Re-runs the same geocode-if-missing fallback as
 * addAddress, so correcting a bad line1/city (or clearing a wrong manual
 * lat/lng) re-resolves the location rather than leaving stale coordinates. */
export async function updateAddress(input: UpdateAddressInput, actorId: string) {
  const existing = await prisma.address.findUniqueOrThrow({ where: { id: input.id } });
  const { latitude, longitude, coordinateStatus } = await resolveAddressCoordinates(input);

  const address = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.address.updateMany({ where: { providerId: input.providerId, id: { not: input.id } }, data: { isPrimary: false } });
    }
    return tx.address.update({
      where: { id: input.id },
      data: {
        addressTypeId: input.addressTypeId,
        line1: input.line1,
        line2: input.line2,
        city: input.city,
        stateProvince: input.stateProvince,
        postalCode: input.postalCode,
        countryId: input.countryId,
        latitude,
        longitude,
        coordinateStatus,
        isPrimary: input.isPrimary,
        notes: input.notes,
        updatedById: actorId,
      },
    });
  });

  await writeAudit({
    entityType: "Address",
    entityId: address.id,
    action: AuditAction.UPDATE,
    actorId,
    previousValue: existing.line1,
    newValue: address.line1,
  });
  return address;
}

export async function deleteAddress(id: string, actorId: string) {
  const address = await prisma.address.delete({ where: { id } });
  await writeAudit({ entityType: "Address", entityId: address.id, action: AuditAction.DELETE, actorId, previousValue: address.line1 });
  return address;
}

export async function addPhone(input: PhoneInput, actorId: string) {
  const phone = await prisma.phone.create({ data: { ...input, createdBy: actorId, updatedBy: actorId } });
  await writeAudit({ entityType: "Phone", entityId: phone.id, action: AuditAction.CREATE, actorId, newValue: phone.number });
  return phone;
}

export async function deletePhone(id: string, actorId: string) {
  const phone = await prisma.phone.delete({ where: { id } });
  await writeAudit({ entityType: "Phone", entityId: phone.id, action: AuditAction.DELETE, actorId, previousValue: phone.number });
  return phone;
}

export async function addEmail(input: EmailInput, actorId: string) {
  const email = await prisma.email.create({ data: { ...input, createdBy: actorId, updatedBy: actorId } });
  await writeAudit({ entityType: "Email", entityId: email.id, action: AuditAction.CREATE, actorId, newValue: email.address });
  return email;
}

export async function deleteEmail(id: string, actorId: string) {
  const email = await prisma.email.delete({ where: { id } });
  await writeAudit({ entityType: "Email", entityId: email.id, action: AuditAction.DELETE, actorId, previousValue: email.address });
  return email;
}

/** `phone`/`email` (both optional) seed the contact's first phone/email row
 * — see administrativeContactSchema. */
export async function addAdministrativeContact(input: AdministrativeContactInput, actorId: string) {
  const { phone, phoneTypeId, email, emailTypeId, ...contactFields } = input;
  return prisma.administrativeContact.create({
    data: {
      ...contactFields,
      createdBy: actorId,
      updatedBy: actorId,
      phones: phone ? { create: { number: phone, phoneTypeId, createdBy: actorId } } : undefined,
      emails: email ? { create: { address: email, emailTypeId, createdBy: actorId } } : undefined,
    },
  });
}

/** `?? null` (not the bare `undefined` optionalString produces for an
 * emptied field) on every optional column — Prisma's `update()` treats an
 * `undefined` value as "leave this column alone," so a bare pass-through
 * would make clearing e.g. title impossible: submitting an empty field would
 * silently leave the old value in place instead of blanking it. */
export async function updateAdministrativeContact(input: UpdateAdministrativeContactInput, actorId: string) {
  return prisma.administrativeContact.update({
    where: { id: input.id },
    data: {
      title: input.title ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle ?? null,
      departmentId: input.departmentId ?? null,
      notes: input.notes ?? null,
      updatedBy: actorId,
    },
  });
}

export async function deleteAdministrativeContact(id: string) {
  return prisma.administrativeContact.delete({ where: { id } });
}

export async function addAdministrativeContactPhone(input: AdministrativeContactPhoneInput, actorId: string) {
  return prisma.administrativeContactPhone.create({ data: { contactId: input.contactId, phoneTypeId: input.phoneTypeId, number: input.number, createdBy: actorId } });
}

export async function deleteAdministrativeContactPhone(id: string) {
  return prisma.administrativeContactPhone.delete({ where: { id } });
}

export async function addAdministrativeContactEmail(input: AdministrativeContactEmailInput, actorId: string) {
  return prisma.administrativeContactEmail.create({ data: { contactId: input.contactId, emailTypeId: input.emailTypeId, address: input.address, createdBy: actorId } });
}

export async function deleteAdministrativeContactEmail(id: string) {
  return prisma.administrativeContactEmail.delete({ where: { id } });
}

/** Bulk-creates every row left in the Office hours dialog after the user has
 * edited/deleted the prefilled default week down to what applies — a no-op
 * (not an error) when they've deleted every row, e.g. to clear a 24/7
 * facility's stale hours without posting a replacement. */
export async function addOfficeHoursBatch(input: OfficeHoursBatchInput, actorId: string) {
  if (input.dayOfWeek.length === 0) return { count: 0 };
  return prisma.providerOfficeHours.createMany({
    data: input.dayOfWeek.map((dayOfWeek, i) => ({
      providerId: input.providerId,
      dayOfWeek,
      openTime: input.openTime[i],
      closeTime: input.closeTime[i],
      createdBy: actorId,
    })),
  });
}

export async function deleteOfficeHours(id: string) {
  return prisma.providerOfficeHours.delete({ where: { id } });
}

/** Provider type works the same way as specialty (see ProviderProviderType):
 * a to-many assignment with one isPrimary, replaced wholesale from a
 * checkbox-style multi-select. */
export async function setProviderTypes(providerId: string, providerTypeIds: string[], primaryProviderTypeId?: string) {
  await prisma.$transaction([
    prisma.providerProviderType.deleteMany({ where: { providerId } }),
    prisma.providerProviderType.createMany({
      data: providerTypeIds.map((providerTypeId) => ({
        providerId,
        providerTypeId,
        isPrimary: providerTypeId === primaryProviderTypeId,
      })),
    }),
  ]);
}

/** Replaces the full specialty assignment set for a provider from a
 * checkbox-style multi-select — simplest correct semantics for a plain
 * many-to-many with no per-row metadata worth diffing. */
export async function setProviderSpecialties(providerId: string, specialtyIds: string[], primarySpecialtyId?: string) {
  await prisma.$transaction([
    prisma.providerSpecialty.deleteMany({ where: { providerId } }),
    prisma.providerSpecialty.createMany({
      data: specialtyIds.map((specialtyId) => ({
        providerId,
        specialtyId,
        isPrimary: specialtyId === primarySpecialtyId,
      })),
    }),
  ]);
}

export async function setProviderLanguages(providerId: string, languageIds: string[]) {
  await prisma.$transaction([
    prisma.providerLanguage.deleteMany({ where: { providerId } }),
    prisma.providerLanguage.createMany({ data: languageIds.map((languageId) => ({ providerId, languageId })) }),
  ]);
}

/** Replaces the provider's Specialized Network and Customized Client Network
 * selections in one go — both fields are saved from the same form. */
export async function setProviderNetworkGroups(providerId: string, specializedNetworkIds: string[], customizedClientNetworkIds: string[]) {
  await prisma.$transaction([
    prisma.providerSpecializedNetwork.deleteMany({ where: { providerId } }),
    prisma.providerSpecializedNetwork.createMany({ data: specializedNetworkIds.map((specializedNetworkId) => ({ providerId, specializedNetworkId })) }),
    prisma.providerCustomizedClientNetwork.deleteMany({ where: { providerId } }),
    prisma.providerCustomizedClientNetwork.createMany({
      data: customizedClientNetworkIds.map((customizedClientNetworkId) => ({ providerId, customizedClientNetworkId })),
    }),
  ]);
}

export async function addProviderCapability(providerId: string, capabilityId: string, notes?: string) {
  return prisma.providerCapability.upsert({
    where: { providerId_capabilityId: { providerId, capabilityId } },
    update: { notes, isActive: true },
    create: { providerId, capabilityId, notes },
  });
}

export async function removeProviderCapability(providerId: string, capabilityId: string) {
  return prisma.providerCapability.delete({ where: { providerId_capabilityId: { providerId, capabilityId } } });
}
