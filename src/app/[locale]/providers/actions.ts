"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireEditProviderData } from "@/lib/rbac";
import { fail, type ActionResult } from "@/lib/validation/common";
import {
  addressSchema,
  updateAddressSchema,
  administrativeContactEmailSchema,
  administrativeContactPhoneSchema,
  administrativeContactSchema,
  capabilityAssignmentSchema,
  networkGroupsSchema,
  providerRatingsSchema,
  createProviderSchema,
  emailSchema,
  officeHoursBatchSchema,
  phoneSchema,
  providerNameSchema,
  setProviderStatusSchema,
  updateAdministrativeContactSchema,
  updateProviderAvailabilitySchema,
  updateProviderCoreSchema,
  updateProviderNotesSchema,
  updateProviderWebsitesSchema,
} from "@/lib/validation/provider";
import { affiliationSchema, credentialSchema, networkContractSchema, updateAffiliationSchema, updateNetworkContractSchema } from "@/lib/validation/credentialing";
import { bankingPaymentSchema, rateSchema } from "@/lib/validation/financial";
import { noteAttachmentSchema, providerVisitSchema } from "@/lib/validation/operations";
import * as providers from "@/data/providers";
import * as childRecords from "@/data/providerChildRecords";
import * as credentialing from "@/data/credentialing";
import * as financial from "@/data/financial";
import * as operations from "@/data/operations";
import { findOrCreateCountry } from "@/data/adminReferenceLists";

// `/[locale]/...` (not the resolved `/providers/...`): routes are nested
// under a locale segment, so this revalidates the page across every locale
// rather than only whichever one triggered the action — see
// https://nextjs.org/docs/app/api-reference/functions/revalidatePath.
function revalidateProvider(providerId: string) {
  revalidatePath(`/[locale]/providers/${providerId}`, "page");
  revalidatePath("/[locale]/providers", "page");
}

/** Used by every action that mutates a *child* record (address, phone,
 * credential, banking, ...) rather than the provider row itself — bumps the
 * "Last updated by ... on ..." stamp shown on the profile header so it
 * reflects a save anywhere in the record, not just core-field edits. Actions
 * that already update the provider row directly (updateProviderCoreAction &
 * friends) use plain revalidateProvider instead, since they've already
 * stamped it themselves; verifyProviderRecordAction also skips this — record
 * verification is a distinct attestation, not a data change. */
async function touchAndRevalidateProvider(providerId: string, actorId: string) {
  await providers.touchProvider(providerId, actorId);
  revalidateProvider(providerId);
}

// --- Provider core -----------------------------------------------------

export async function createProviderAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  // Object.fromEntries collapses repeated keys to their last value, so
  // providerTypeIds (a checkbox multi-select) needs getAll — same reason the
  // taxonomy assignment actions below don't use Object.fromEntries either.
  const parsed = createProviderSchema.safeParse({
    ...Object.fromEntries(formData),
    providerTypeIds: formData.getAll("providerTypeIds"),
  });
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  const provider = await providers.createProvider(parsed.data, actor.id);
  revalidatePath("/[locale]/providers", "page");
  // Continue the creation wizard (steps 2-6), not the full tabbed profile —
  // see src/app/[locale]/providers/new/[id]/page.tsx. Locale-aware redirect:
  // a plain next/navigation redirect would drop the locale prefix and bounce
  // a French user back to the default English URL.
  const locale = await getLocale();
  return redirect({ href: `/providers/new/${provider.id}?step=2`, locale });
}

export async function updateProviderCoreAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = updateProviderCoreSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await providers.updateProviderCore(parsed.data, actor.id);
  revalidateProvider(parsed.data.id);
  return { success: true };
}

export async function updateProviderNotesAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = updateProviderNotesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await providers.updateProviderNotes(parsed.data, actor.id);
  revalidateProvider(parsed.data.id);
  return { success: true };
}

export async function updateProviderWebsitesAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = updateProviderWebsitesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await providers.updateProviderWebsites(parsed.data, actor.id);
  revalidateProvider(parsed.data.id);
  return { success: true };
}

export async function updateProviderAvailabilityAction(formData: FormData): Promise<void> {
  const parsed = updateProviderAvailabilitySchema.parse(Object.fromEntries(formData));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await providers.updateProviderAvailability(parsed, actor.id);
  revalidateProvider(parsed.id);
}

export async function verifyProviderRecordAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await providers.verifyProviderRecord(id, actor.id);
  revalidateProvider(id);
}

export async function updateProviderRatingsAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = providerRatingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await providers.setProviderRatings(parsed.data.providerId, parsed.data.qualityRating, parsed.data.accessRating);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function setProviderStatusAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = setProviderStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  const result = await providers.setProviderStatus(parsed.data, actor.id);
  if (!result.success) return fail({ status: result.gaps });

  revalidateProvider(parsed.data.id);
  return { success: true };
}

// --- Names / addresses / contacts --------------------------------------

export async function addProviderNameAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = providerNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addProviderName(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteProviderNameAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deleteProviderName(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addAddressAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addAddress(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function updateAddressAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = updateAddressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.updateAddress(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deleteAddress(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

/** Called directly (not as a form action) from the address-lookup typeahead
 * in addresses-section.tsx when a picked Nominatim result's country isn't in
 * CountryRef yet — provisions it instead of leaving the Country field
 * unset. findOrCreateCountry matches by iso2 first, so this never creates a
 * duplicate of a country another address save (or an admin, via Value
 * Lists) already added. Also revalidates the admin page since the new
 * country now belongs in that list too. */
export async function findOrCreateCountryAction(iso2: string, name: string): Promise<{ id: string; label: string; iso2: string }> {
  const parsed = z.object({ iso2: z.string().length(2), name: z.string().trim().min(1) }).parse({ iso2, name });
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  const country = await findOrCreateCountry(parsed.iso2, parsed.name, actor.id);
  revalidatePath("/[locale]/admin", "page");
  return { id: country.id, label: country.name, iso2: country.iso2 };
}

export async function addPhoneAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = phoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addPhone(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deletePhoneAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deletePhone(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addEmailAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addEmail(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteEmailAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deleteEmail(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addAdministrativeContactAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = administrativeContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addAdministrativeContact(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function updateAdministrativeContactAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = updateAdministrativeContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.updateAdministrativeContact(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteAdministrativeContactAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deleteAdministrativeContact(id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addAdministrativeContactPhoneAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = administrativeContactPhoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addAdministrativeContactPhone(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteAdministrativeContactPhoneAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deleteAdministrativeContactPhone(id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addAdministrativeContactEmailAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = administrativeContactEmailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addAdministrativeContactEmail(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteAdministrativeContactEmailAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deleteAdministrativeContactEmail(id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

// --- Provider type / specialty / language / capability -------------------

const taxonomyAssignmentSchema = z.object({
  providerId: z.uuid(),
  ids: z.array(z.uuid()),
  primaryId: z.uuid().optional(),
});

export async function setProviderTypesAction(formData: FormData): Promise<void> {
  const parsed = taxonomyAssignmentSchema.parse({
    providerId: formData.get("providerId"),
    ids: formData.getAll("providerTypeIds"),
    primaryId: formData.get("primaryProviderTypeId") || undefined,
  });
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.setProviderTypes(parsed.providerId, parsed.ids, parsed.primaryId);
  await touchAndRevalidateProvider(parsed.providerId, actor.id);
}

export async function setProviderSpecialtiesAction(formData: FormData): Promise<void> {
  const parsed = taxonomyAssignmentSchema.parse({
    providerId: formData.get("providerId"),
    ids: formData.getAll("specialtyIds"),
    primaryId: formData.get("primarySpecialtyId") || undefined,
  });
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.setProviderSpecialties(parsed.providerId, parsed.ids, parsed.primaryId);
  await touchAndRevalidateProvider(parsed.providerId, actor.id);
}

export async function setProviderLanguagesAction(formData: FormData): Promise<void> {
  const parsed = taxonomyAssignmentSchema.parse({
    providerId: formData.get("providerId"),
    ids: formData.getAll("languageIds"),
  });
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.setProviderLanguages(parsed.providerId, parsed.ids);
  await touchAndRevalidateProvider(parsed.providerId, actor.id);
}

export async function setProviderNetworkGroupsAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = networkGroupsSchema.safeParse({
    providerId: formData.get("providerId"),
    specializedNetworkIds: formData.getAll("specializedNetworkIds"),
    customizedClientNetworkIds: formData.getAll("customizedClientNetworkIds"),
  });
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.setProviderNetworkGroups(parsed.data.providerId, parsed.data.specializedNetworkIds, parsed.data.customizedClientNetworkIds);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function addProviderCapabilityAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = capabilityAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addProviderCapability(parsed.data.providerId, parsed.data.capabilityId, parsed.data.notes);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function removeProviderCapabilityAction(formData: FormData): Promise<void> {
  const providerId = z.uuid().parse(formData.get("providerId"));
  const capabilityId = z.uuid().parse(formData.get("capabilityId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.removeProviderCapability(providerId, capabilityId);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addOfficeHoursBatchAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  // Parallel arrays, not Object.fromEntries — same reason providerTypeIds
  // uses getAll elsewhere: repeated `dayOfWeek`/`openTime`/`closeTime` fields
  // (one triplet per row left in the dialog) would otherwise collapse to
  // just their last value.
  const parsed = officeHoursBatchSchema.safeParse({
    providerId: formData.get("providerId"),
    dayOfWeek: formData.getAll("dayOfWeek"),
    openTime: formData.getAll("openTime"),
    closeTime: formData.getAll("closeTime"),
  });
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.addOfficeHoursBatch(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteOfficeHoursAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await childRecords.deleteOfficeHours(id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

// --- Credentialing -------------------------------------------------------

export async function addCredentialAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = credentialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.addCredential(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteCredentialAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.deleteCredential(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addNetworkContractAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = networkContractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.addNetworkContract(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function updateNetworkContractAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = updateNetworkContractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.updateNetworkContract(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteNetworkContractAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.deleteNetworkContract(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addAffiliationAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = affiliationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.addAffiliation(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function updateAffiliationAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = updateAffiliationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.updateAffiliation(parsed.data.id, parsed.data.affiliationTypeId, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteAffiliationAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await credentialing.deleteAffiliation(id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

/** Called directly (not as a form action) from the "Related Provider" search
 * box in affiliations-section.tsx. A read, not a mutation — any signed-in
 * actor can search, same as they can already view the affiliations list;
 * requireEditProviderData still gates the actual add/delete above. */
export async function searchAffiliationCandidatesAction(query: string, excludeProviderId: string) {
  const parsed = z.object({ query: z.string().trim().min(1).max(100), excludeProviderId: z.uuid() }).parse({ query, excludeProviderId });
  await getCurrentActor();
  const locale = await getLocale();
  return providers.searchAffiliationCandidates(parsed.query, parsed.excludeProviderId, locale);
}

// --- Financial (banking role-gated per Phase 5 TODO, rates) --------------

export async function addBankingPaymentAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = bankingPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  if (!financial.canManageBanking(actor)) return fail({ providerId: ["Not authorized to manage banking details"] });

  // What's collected depends on the payment type's category: a mobile money
  // record needs the wallet number (merchant code optional) and carries no
  // bank details; a bank record carries no mobile money fields.
  const paymentType = await financial.getPaymentType(parsed.data.paymentTypeId);
  if (!paymentType) return fail({ paymentTypeId: ["Select a payment type"] });
  let input = parsed.data;
  if (paymentType.category === "MOBILE_MONEY") {
    if (!input.mobileMoneyNumber) return fail({ mobileMoneyNumber: ["Enter the mobile money number"] });
    input = { ...input, bankName: undefined, bankAccountNumber: undefined, bankRoutingOrSwift: undefined, bankAccountTypeId: undefined };
  } else {
    input = { ...input, mobileMoneyNumber: undefined, merchantCode: undefined };
  }

  await financial.addBankingPayment(input, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function approveBankingPaymentAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  if (!financial.canManageBanking(actor)) return;
  await financial.approveBankingPayment(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function deleteBankingPaymentAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  if (!financial.canManageBanking(actor)) return;
  await financial.deleteBankingPayment(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addRateAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await financial.addRate(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function approveRateAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await financial.approveRate(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function deleteRateAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await financial.deleteRate(id, actor.id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

// --- Visits / notes --------------------------------------------------------

export async function addProviderVisitAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = providerVisitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await operations.addProviderVisit(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteProviderVisitAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await operations.deleteProviderVisit(id);
  await touchAndRevalidateProvider(providerId, actor.id);
}

export async function addNoteAttachmentAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = noteAttachmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await operations.addNoteAttachment(parsed.data, actor.id);
  await touchAndRevalidateProvider(parsed.data.providerId, actor.id);
  return { success: true };
}

export async function deleteNoteAttachmentAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const providerId = z.uuid().parse(formData.get("providerId"));
  const actor = await getCurrentActor();
  requireEditProviderData(actor);
  await operations.deleteNoteAttachment(id);
  await touchAndRevalidateProvider(providerId, actor.id);
}
