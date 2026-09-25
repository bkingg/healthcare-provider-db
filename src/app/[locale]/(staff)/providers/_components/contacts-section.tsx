"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  addAdministrativeContactAction,
  addAdministrativeContactEmailAction,
  addAdministrativeContactPhoneAction,
  addEmailAction,
  addPhoneAction,
  deleteAdministrativeContactAction,
  deleteAdministrativeContactEmailAction,
  deleteAdministrativeContactPhoneAction,
  deleteEmailAction,
  deletePhoneAction,
  updateAdministrativeContactAction,
} from "@/app/[locale]/(staff)/providers/actions";
import { PnPanel } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PhoneNumberField } from "./phone-number-field";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

type AdminContact = ProviderProfile["administrativeContacts"][number];

export function ContactsSection({
  provider,
  phoneTypes,
  emailTypes,
  departments,
}: {
  provider: ProviderProfile;
  phoneTypes: { id: string; label: string }[];
  emailTypes: { id: string; label: string }[];
  departments: { id: string; label: string }[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <PhonesCard provider={provider} phoneTypes={phoneTypes} />
      <EmailsCard provider={provider} emailTypes={emailTypes} />
      <AdministrativeContactsCard provider={provider} departments={departments} phoneTypes={phoneTypes} emailTypes={emailTypes} />
    </div>
  );
}

function PhonesCard({ provider, phoneTypes }: { provider: ProviderProfile; phoneTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Contacts");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addPhoneAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnPanel title={t("phonesTitle")} className="flex flex-col gap-3">
        <Table>
          <TableBody>
            {provider.phones.map((phone) => (
              <TableRow key={phone.id}>
                <TableCell className="text-muted-foreground">{phone.phoneType.name}</TableCell>
                <TableCell>{phone.number}</TableCell>
                <TableCell>
                  <InlineDeleteForm action={deletePhoneAction} hiddenFields={{ id: phone.id, providerId: provider.id }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* Keyed by the phone count so PhoneNumberField's controlled country
         * selection resets to the provider's own country after each add —
         * see the component's own doc comment. */}
        <form key={provider.phones.length} action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="providerId" value={provider.id} />
          <RefSelect name="phoneTypeId" options={phoneTypes} placeholder={t("typePlaceholder")} required />
          <PhoneNumberField name="number" defaultCountryIso2={provider.country.iso2} placeholder={t("phoneNumberPlaceholder")} required />
          <FieldError messages={errors.number} />
          <SubmitButton variant="outline" size="sm">
            {t("addPhone")}
          </SubmitButton>
        </form>
    </PnPanel>
  );
}

function EmailsCard({ provider, emailTypes }: { provider: ProviderProfile; emailTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Contacts");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addEmailAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnPanel title={t("emailsTitle")} className="flex flex-col gap-3">
        <Table>
          <TableBody>
            {provider.emails.map((email) => (
              <TableRow key={email.id}>
                <TableCell className="text-muted-foreground">{email.emailType.name}</TableCell>
                <TableCell>{email.address}</TableCell>
                <TableCell>
                  <InlineDeleteForm action={deleteEmailAction} hiddenFields={{ id: email.id, providerId: provider.id }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="providerId" value={provider.id} />
          <RefSelect name="emailTypeId" options={emailTypes} placeholder={t("typePlaceholder")} required />
          <Input name="address" type="email" placeholder={t("emailAddressPlaceholder")} required />
          <FieldError messages={errors.address} />
          <SubmitButton variant="outline" size="sm">
            {t("addEmail")}
          </SubmitButton>
        </form>
    </PnPanel>
  );
}

/** Compact type dropdown beside its value field (phone/email of an
 * administrative contact), instead of a full-width select stacked on top. */
function TypeBesideField({ children, select }: { children: React.ReactNode; select: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <div className="w-24 flex-none">{select}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Department dropdown, sourced from the admin-managed Departments list. The
 * leading "None" option (id "") is how a contact's department gets cleared —
 * an empty value validates as "no department" (see optionalUuid). */
function DepartmentSelect({ departments, defaultValue }: { departments: { id: string; label: string }[]; defaultValue: string }) {
  const t = useTranslations("Sections.Contacts");
  return (
    <RefSelect
      name="departmentId"
      options={[{ id: "", label: t("noDepartment") }, ...departments]}
      defaultValue={defaultValue}
      placeholder={t("departmentPlaceholder")}
    />
  );
}

/** Edit an existing administrative contact — name/title/job title/department/
 * notes, plus its phones and emails (each its own add/delete, same shape as
 * the Phones/Emails panels above). Kept as one dialog with several
 * independent forms rather than several dialogs or a Save & Close flow,
 * since editing a contact's details and adding another phone are both
 * "still working on this contact" — the dialog stays open after every save
 * (unlike EditAddressDialog) so the user can keep making changes without
 * reopening it each time; they close it themselves when done. */
function EditAdministrativeContactDialog({ contact, provider, departments, phoneTypes, emailTypes }: { contact: AdminContact; provider: ProviderProfile; departments: { id: string; label: string }[]; phoneTypes: { id: string; label: string }[]; emailTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Contacts");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateAdministrativeContactAction, null);
  const errors = state && !state.success ? state.errors : {};
  const [phoneState, phoneFormAction] = useActionState<ActionResult | null, FormData>(addAdministrativeContactPhoneAction, null);
  const phoneErrors = phoneState && !phoneState.success ? phoneState.errors : {};
  const [emailState, emailFormAction] = useActionState<ActionResult | null, FormData>(addAdministrativeContactEmailAction, null);
  const emailErrors = emailState && !emailState.success ? emailState.errors : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className="cursor-pointer text-pn-gray-2 hover:text-pn-ink" aria-label={t("edit")}>
            <Pencil size={14} />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editContactTitle")}</DialogTitle>
        </DialogHeader>
        {/* Keyed on updatedAt: a save feeds this same mounted dialog fresh
         * `contact` data while it's likely still open — without a remount,
         * the uncontrolled inputs' defaultValue would go stale (same class
         * of bug as EditAddressDialog / provider-header.tsx's edit dialog). */}
        <form key={contact.updatedAt.getTime()} action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="providerId" value={provider.id} />
          <div className="flex gap-2">
            <Input name="title" placeholder={t("titlePlaceholder")} defaultValue={contact.title ?? ""} className="w-28 flex-none" />
            <Input name="firstName" placeholder={t("firstNamePlaceholder")} defaultValue={contact.firstName} required />
            <Input name="lastName" placeholder={t("lastNamePlaceholder")} defaultValue={contact.lastName} required />
          </div>
          <FieldError messages={errors.firstName ?? errors.lastName} />
          <Input name="jobTitle" placeholder={t("jobTitlePlaceholder")} defaultValue={contact.jobTitle ?? ""} />
          <DepartmentSelect departments={departments} defaultValue={contact.departmentId ?? ""} />
          <Input name="notes" placeholder={t("notesPlaceholder")} defaultValue={contact.notes ?? ""} />
          <SubmitButton variant="outline" size="sm" className="self-start">
            {t("save")}
          </SubmitButton>
        </form>

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <span className="text-xs font-semibold">{t("phonesLabel")}</span>
          {contact.phones.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noPhones")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {contact.phones.map((phone) => (
                <li key={phone.id} className="flex items-center justify-between text-sm">
                  <span>{phone.number}{phone.phoneType ? ` (${phone.phoneType.name})` : ""}</span>
                  <InlineDeleteForm action={deleteAdministrativeContactPhoneAction} hiddenFields={{ id: phone.id, providerId: provider.id }} />
                </li>
              ))}
            </ul>
          )}
          {/* Keyed by phone count so PhoneNumberField's country selection
           * resets after each add — same reasoning as PhonesCard above. */}
          <form key={contact.phones.length} action={phoneFormAction} className="flex flex-col gap-2">
            <input type="hidden" name="contactId" value={contact.id} />
            <input type="hidden" name="providerId" value={provider.id} />
            <TypeBesideField select={<RefSelect name="phoneTypeId" options={phoneTypes} placeholder={t("typePlaceholder")} required />}>
              <PhoneNumberField name="number" defaultCountryIso2={provider.country.iso2} placeholder={t("phoneNumberPlaceholder")} required />
            </TypeBesideField>
            <FieldError messages={phoneErrors.phoneTypeId ?? phoneErrors.number} />
            <SubmitButton variant="outline" size="sm" className="self-start">
              {t("addAnotherPhone")}
            </SubmitButton>
          </form>
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <span className="text-xs font-semibold">{t("emailsLabel")}</span>
          {contact.emails.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noEmails")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {contact.emails.map((email) => (
                <li key={email.id} className="flex items-center justify-between text-sm">
                  <span>{email.address}{email.emailType ? ` (${email.emailType.name})` : ""}</span>
                  <InlineDeleteForm action={deleteAdministrativeContactEmailAction} hiddenFields={{ id: email.id, providerId: provider.id }} />
                </li>
              ))}
            </ul>
          )}
          <form key={contact.emails.length} action={emailFormAction} className="flex flex-col gap-2">
            <input type="hidden" name="contactId" value={contact.id} />
            <input type="hidden" name="providerId" value={provider.id} />
            <TypeBesideField select={<RefSelect name="emailTypeId" options={emailTypes} placeholder={t("typePlaceholder")} required />}>
              <Input name="address" type="email" placeholder={t("emailAddressPlaceholder")} required />
            </TypeBesideField>
            <FieldError messages={emailErrors.emailTypeId ?? emailErrors.address} />
            <SubmitButton variant="outline" size="sm" className="self-start">
              {t("addAnotherEmail")}
            </SubmitButton>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Add contact" — opens a popup with the same fields the inline add-form
 * used to show permanently on screen, so the panel just lists existing
 * contacts until you actually want to add one. Auto-closes on a successful
 * add, same as AddAddressDialog. The trigger sits at the bottom of the white
 * content box, same spot and styling as the Phones/Emails panels' inline
 * "Add phone"/"Add email" buttons — those panels are otherwise untouched,
 * keeping their permanently-visible inline add-forms. */
function AddAdministrativeContactDialog({ provider, departments, phoneTypes, emailTypes }: { provider: ProviderProfile; departments: { id: string; label: string }[]; phoneTypes: { id: string; label: string }[]; emailTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Contacts");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addAdministrativeContactAction, null);
  const errors = state && !state.success ? state.errors : {};

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="self-start">
            {t("addContact")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addContact")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="providerId" value={provider.id} />
          <div className="flex gap-2">
            <Input name="title" placeholder={t("titlePlaceholder")} className="w-28 flex-none" />
            <Input name="firstName" placeholder={t("firstNamePlaceholder")} required />
            <Input name="lastName" placeholder={t("lastNamePlaceholder")} required />
          </div>
          <FieldError messages={errors.firstName ?? errors.lastName} />
          <Input name="jobTitle" placeholder={t("jobTitlePlaceholder")} />
          <DepartmentSelect departments={departments} defaultValue="" />
          <TypeBesideField select={<RefSelect name="emailTypeId" options={emailTypes} placeholder={t("typePlaceholder")} />}>
            <Input name="email" type="email" placeholder={t("emailPlaceholder")} />
          </TypeBesideField>
          <FieldError messages={errors.emailTypeId ?? errors.email} />
          <TypeBesideField select={<RefSelect name="phoneTypeId" options={phoneTypes} placeholder={t("typePlaceholder")} />}>
            <PhoneNumberField name="phone" defaultCountryIso2={provider.country.iso2} placeholder={t("phonePlaceholder")} />
          </TypeBesideField>
          <FieldError messages={errors.phoneTypeId} />
          <Input name="notes" placeholder={t("notesPlaceholder")} />
          <SubmitButton variant="outline" size="sm" className="self-start">
            {t("addContact")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdministrativeContactsCard({ provider, departments, phoneTypes, emailTypes }: { provider: ProviderProfile; departments: { id: string; label: string }[]; phoneTypes: { id: string; label: string }[]; emailTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Sections.Contacts");

  return (
    <PnPanel title={t("adminTitle")} className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {provider.administrativeContacts.map((contact) => (
            <li key={contact.id} className="flex items-start justify-between gap-2 border-b border-pn-rule pb-2 text-sm last:border-b-0">
              <div className="min-w-0">
                <div>
                  {contact.title ? `${contact.title} ` : ""}
                  {contact.firstName} {contact.lastName}
                </div>
                {(contact.jobTitle || contact.department) && (
                  <div className="text-xs text-muted-foreground">{[contact.jobTitle, contact.department?.name].filter(Boolean).join(" · ")}</div>
                )}
                {(contact.phones.length > 0 || contact.emails.length > 0) && (
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {contact.phones.map((phone) => (
                      <span key={phone.id}>{phone.number}{phone.phoneType ? ` (${phone.phoneType.name})` : ""}</span>
                    ))}
                    {contact.emails.map((email) => (
                      <span key={email.id}>{email.address}{email.emailType ? ` (${email.emailType.name})` : ""}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-none items-center gap-1">
                <EditAdministrativeContactDialog contact={contact} provider={provider} departments={departments} phoneTypes={phoneTypes} emailTypes={emailTypes} />
                <InlineDeleteForm
                  action={deleteAdministrativeContactAction}
                  hiddenFields={{ id: contact.id, providerId: provider.id }}
                />
              </div>
            </li>
          ))}
          {provider.administrativeContacts.length === 0 && <p className="text-sm text-muted-foreground">{t("noContacts")}</p>}
        </ul>
        <AddAdministrativeContactDialog provider={provider} departments={departments} phoneTypes={phoneTypes} emailTypes={emailTypes} />
    </PnPanel>
  );
}
