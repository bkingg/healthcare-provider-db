import { z } from "zod";
import { CoordinateStatus, DayOfWeek, OperatingStatus, ProviderNameKind, ProviderNameType, ProviderStatus } from "@/lib/enums";
import { checkboxValue, optionalIsoDate, optionalString, optionalUrl, optionalUuid, requiredString, requiredTimeOfDay, uuidSchema } from "./common";

/** Shared entity-vs-individual branch: an entity needs a facility/org name; an
 * individual needs at least a first and last name (title is optional either
 * way). Added to a schema via `.superRefine(nameKindRefinement)` so the two
 * places a name gets entered (provider creation, and the Names panel's
 * "add a name variant" form) validate the same rule the same way. */
function nameKindRefinement(
  data: { nameKind: ProviderNameKind; facilityName?: string; individualFirstName?: string; individualLastName?: string },
  ctx: z.RefinementCtx,
) {
  if (data.nameKind === ProviderNameKind.ENTITY) {
    if (!data.facilityName) ctx.addIssue({ code: "custom", message: "Organization / facility name is required", path: ["facilityName"] });
  } else {
    if (!data.individualFirstName) ctx.addIssue({ code: "custom", message: "First name is required", path: ["individualFirstName"] });
    if (!data.individualLastName) ctx.addIssue({ code: "custom", message: "Last name is required", path: ["individualLastName"] });
  }
}

/** Fields required to create a Provider — deliberately narrow: full profile
 * completeness is enforced separately by activation gating, not at creation.
 * providerTypeIds mirrors the Clinical services tab's checkbox multi-select
 * (a provider can be more than one type from the start, e.g. both Hospital
 * and Teaching Facility) — primaryProviderTypeId picks which one is primary,
 * defaulting to the first checked if left unset. Additional types can still
 * be added/reassigned afterward from the Clinical services tab, same as
 * specialties; this just lets creation start with more than one. */
export const createProviderSchema = z
  .object({
    providerTypeIds: z.array(uuidSchema).min(1, "Select at least one provider type"),
    primaryProviderTypeId: optionalUuid,
    countryId: uuidSchema,
    operatingStatus: z.enum(OperatingStatus).default(OperatingStatus.UNKNOWN),
    profileSummary: optionalString,
    externalId: optionalString,
    // Minimum-required-profile: at least a legal/display name up front.
    nameType: z.enum(ProviderNameType).default(ProviderNameType.LEGAL),
    // Entity vs. individual, prompted once at creation — see nameKindRefinement.
    nameKind: z.enum(ProviderNameKind).default(ProviderNameKind.ENTITY),
    facilityName: optionalString,
    individualTitleId: optionalUuid,
    individualFirstName: optionalString,
    individualLastName: optionalString,
  })
  .superRefine(nameKindRefinement);
export type CreateProviderInput = z.infer<typeof createProviderSchema>;

/** Entity/individual can be changed after creation from the profile page's
 * "Edit profile" dialog — same fields and the same nameKindRefinement rule as
 * creation, since changing it also rewrites the provider's primary name. */
export const updateProviderCoreSchema = z
  .object({
    id: uuidSchema,
    countryId: uuidSchema,
    operatingStatus: z.enum(OperatingStatus),
    profileSummary: optionalString,
    externalId: optionalString,
    nameKind: z.enum(ProviderNameKind),
    facilityName: optionalString,
    individualTitleId: optionalUuid,
    individualFirstName: optionalString,
    individualLastName: optionalString,
  })
  .superRefine(nameKindRefinement);
export type UpdateProviderCoreInput = z.infer<typeof updateProviderCoreSchema>;

/** The two fixed "Notes" sidebar-widget fields — distinct from the freeform,
 * many-per-provider NoteAttachment collection behind the "Notes & documents"
 * tab. Exactly one Internal and one External note per provider. */
export const updateProviderNotesSchema = z.object({
  id: uuidSchema,
  internalNotes: optionalString,
  externalNotes: optionalString,
});
export type UpdateProviderNotesInput = z.infer<typeof updateProviderNotesSchema>;

/** The two Website sidebar-widget fields (Provider.websiteUrl1/2) — same
 * small-dedicated-schema shape as Notes above, edited from its own widget
 * rather than the "Edit profile" dialog. */
export const updateProviderWebsitesSchema = z.object({
  id: uuidSchema,
  websiteUrl1: optionalUrl,
  websiteUrl2: optionalUrl,
});
export type UpdateProviderWebsitesInput = z.infer<typeof updateProviderWebsitesSchema>;

/** The two Clinical services tab availability checkboxes. */
export const updateProviderAvailabilitySchema = z.object({
  id: uuidSchema,
  isOpen24_7: checkboxValue,
  erOpen24_7: checkboxValue,
});
export type UpdateProviderAvailabilityInput = z.infer<typeof updateProviderAvailabilitySchema>;

/** The Office hours dialog (see office-hours-dialog.tsx) prefills a default
 * week of rows and submits whatever the user leaves after editing/deleting
 * down to what applies, all at once — parallel `dayOfWeek`/`openTime`/
 * `closeTime` arrays (repeated form fields, read via FormData.getAll, same
 * pattern as providerTypeIds elsewhere) rather than one row per request.
 * A day with a lunch closure is just two rows sharing a dayOfWeek, not one
 * row with a gap. Doesn't reject overnight spans (closeTime < openTime, e.g.
 * a night clinic open 22:00-02:00) since the DB has no way to tell "closes
 * after midnight" from "closes before it opens" without also knowing which
 * day the close falls on — flagged as a data-entry risk rather than
 * validated away. */
export const officeHoursBatchSchema = z
  .object({
    providerId: uuidSchema,
    dayOfWeek: z.array(z.enum(DayOfWeek)),
    openTime: z.array(requiredTimeOfDay),
    closeTime: z.array(requiredTimeOfDay),
  })
  .refine((data) => data.openTime.length === data.dayOfWeek.length && data.closeTime.length === data.dayOfWeek.length, {
    message: "Each row needs a day, an opening time, and a closing time",
    path: ["dayOfWeek"],
  });
export type OfficeHoursBatchInput = z.infer<typeof officeHoursBatchSchema>;

export const setProviderStatusSchema = z.object({
  id: uuidSchema,
  status: z.enum(ProviderStatus),
  reason: optionalString,
});
export type SetProviderStatusInput = z.infer<typeof setProviderStatusSchema>;

export const providerNameSchema = z
  .object({
    providerId: uuidSchema,
    nameType: z.enum(ProviderNameType),
    // Not user-chosen here — passed as a hidden field mirroring the
    // provider's own nameKind (only chosen once, at creation), so this
    // "add a name variant" form shows the right fields without letting one
    // name row disagree with the provider's overall entity/individual kind.
    nameKind: z.enum(ProviderNameKind),
    facilityName: optionalString,
    individualTitleId: optionalUuid,
    individualFirstName: optionalString,
    individualMiddleName: optionalString,
    individualLastName: optionalString,
    individualSuffix: optionalString,
    isPrimary: checkboxValue,
  })
  .superRefine(nameKindRefinement);
export type ProviderNameInput = z.infer<typeof providerNameSchema>;

export const addressSchema = z.object({
  providerId: uuidSchema,
  addressTypeId: uuidSchema,
  line1: requiredString("Address line 1"),
  line2: optionalString,
  city: requiredString("City"),
  stateProvince: optionalString,
  postalCode: optionalString,
  countryId: uuidSchema,
  latitude: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (v >= -90 && v <= 90), "Latitude must be between -90 and 90"),
  longitude: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (v >= -180 && v <= 180), "Longitude must be between -180 and 180"),
  coordinateStatus: z.enum(CoordinateStatus).default(CoordinateStatus.MISSING),
  isPrimary: checkboxValue,
  notes: optionalString,
});
export type AddressInput = z.infer<typeof addressSchema>;

export const updateAddressSchema = addressSchema.extend({ id: uuidSchema });
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

export const phoneSchema = z.object({
  providerId: uuidSchema,
  phoneTypeId: uuidSchema,
  number: requiredString("Phone number"),
  extension: optionalString,
  notes: optionalString,
});
export type PhoneInput = z.infer<typeof phoneSchema>;

export const emailSchema = z.object({
  providerId: uuidSchema,
  emailTypeId: uuidSchema,
  address: z.email("Enter a valid email address"),
  notes: optionalString,
});
export type EmailInput = z.infer<typeof emailSchema>;

/** `phone`/`email` here seed the contact's *first* AdministrativeContactPhone/
 * -Email row (see providerChildRecords.ts::addAdministrativeContact) — both
 * optional, since a contact can be added with neither and grow phones/emails
 * later via the edit dialog's own add-phone/add-email forms. Not stored as
 * scalars on AdministrativeContact itself; that field pair was replaced by
 * the phones/emails relations so a contact can carry more than one of each. */
export const administrativeContactSchema = z.object({
  providerId: uuidSchema,
  title: optionalString,
  firstName: requiredString("First name"),
  lastName: requiredString("Last name"),
  jobTitle: optionalString,
  departmentId: optionalUuid,
  phone: optionalString,
  phoneTypeId: optionalUuid,
  email: z.union([z.email(), z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  emailTypeId: optionalUuid,
  notes: optionalString,
})
  // A type is only required alongside the value it describes.
  .refine((d) => !d.phone || d.phoneTypeId, { path: ["phoneTypeId"], message: "Select a phone type" })
  .refine((d) => !d.email || d.emailTypeId, { path: ["emailTypeId"], message: "Select an email type" });
export type AdministrativeContactInput = z.infer<typeof administrativeContactSchema>;

export const updateAdministrativeContactSchema = z.object({
  id: uuidSchema,
  providerId: uuidSchema,
  title: optionalString,
  firstName: requiredString("First name"),
  lastName: requiredString("Last name"),
  jobTitle: optionalString,
  departmentId: optionalUuid,
  notes: optionalString,
});
export type UpdateAdministrativeContactInput = z.infer<typeof updateAdministrativeContactSchema>;

export const administrativeContactPhoneSchema = z.object({
  contactId: uuidSchema,
  providerId: uuidSchema,
  phoneTypeId: uuidSchema,
  number: requiredString("Phone number"),
});
export type AdministrativeContactPhoneInput = z.infer<typeof administrativeContactPhoneSchema>;

export const administrativeContactEmailSchema = z.object({
  contactId: uuidSchema,
  providerId: uuidSchema,
  emailTypeId: uuidSchema,
  address: z.email("Enter a valid email address"),
});
export type AdministrativeContactEmailInput = z.infer<typeof administrativeContactEmailSchema>;

export const networkGroupsSchema = z.object({
  providerId: uuidSchema,
  specializedNetworkIds: z.array(uuidSchema),
  customizedClientNetworkIds: z.array(uuidSchema),
});

/** A star field arrives as "" (not rated) or "1"-"5". */
const starField = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .pipe(z.number().int().min(1).max(5).nullable());

export const providerRatingsSchema = z.object({
  providerId: uuidSchema,
  qualityRating: starField,
  accessRating: starField,
});

export const capabilityAssignmentSchema = z.object({
  providerId: uuidSchema,
  capabilityId: uuidSchema,
  notes: optionalString,
});

export { optionalIsoDate, optionalUuid };
