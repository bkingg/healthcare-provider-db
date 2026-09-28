"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, UserPlus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";
import { createMemberAction, updateMemberAction } from "../actions";

type Option = { id: string; label: string };

/** Serializable member values for the form — dates as "YYYY-MM-DD". */
export type MemberFormValues = {
  id?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
  countryId?: string;
  city?: string;
  primaryMemberId?: string;
  relationshipId?: string;
  organizationId?: string;
  planName?: string;
  policyNumber?: string;
  coverageStart?: string;
  coverageEnd?: string;
  isCovered?: boolean;
};

export type MemberFormOptions = {
  countries: Option[];
  organizations: Option[];
  relationships: Option[];
  primaryMembers: Option[];
};

function Field({ id, label, errors, children, wide }: { id: string; label: string; errors?: string[]; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError messages={errors} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-pn-rule pb-1 text-[11px] font-bold tracking-[0.08em] text-pn-gray-1 uppercase sm:col-span-2">{children}</div>;
}

/** Add member / edit member / add dependent — one form, three entry points.
 * "Add dependent" opens it with the household fields pre-filled from the
 * primary member (surname, organization, plan, location), so staff only
 * type what differs. */
export function MemberFormDialog({
  mode,
  values = {},
  options,
}: {
  mode: "create" | "edit" | "addDependent";
  values?: MemberFormValues;
  options: MemberFormOptions;
}) {
  const t = useTranslations("Members");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDependent, setIsDependent] = useState(Boolean(values.primaryMemberId));
  const [isCovered, setIsCovered] = useState(values.isCovered ?? true);
  const [state, formAction] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    mode === "edit" ? updateMemberAction : createMemberAction,
    null,
  );
  const errors = state && !state.success ? state.errors : {};

  // Close on a successful save — adjusted during render from the action's
  // result, same pattern as EditUserDialog (no setState in an effect).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  // A newly added member (or dependent) opens on their own page.
  const createdId = mode !== "edit" && state?.success ? state.data?.id : undefined;
  useEffect(() => {
    if (createdId) router.push(`/members/${createdId}`);
  }, [createdId, router]);

  // A member can't be their own primary.
  const primaryOptions = options.primaryMembers.filter((o) => o.id !== values.id);

  const trigger =
    mode === "edit" ? (
      <button type="button" className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover">
        <Pencil size={13} /> {t("edit")}
      </button>
    ) : mode === "addDependent" ? (
      <button type="button" className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover">
        <UserPlus size={13} /> {t("addDependent")}
      </button>
    ) : (
      <button type="button" className="flex h-8 cursor-pointer items-center gap-[7px] border-none bg-pn-accent px-3 text-xs font-semibold text-white hover:bg-pn-accent-hover">
        <Plus size={14} /> {t("addMember")}
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? t("editTitle") : mode === "addDependent" ? t("addDependentTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          {values.id && <input type="hidden" name="id" value={values.id} />}

          <SectionTitle>{t("sectionPerson")}</SectionTitle>
          <Field id="firstName" label={t("firstName")} errors={errors.firstName}>
            <Input id="firstName" name="firstName" defaultValue={values.firstName} required autoComplete="off" />
          </Field>
          <Field id="lastName" label={t("lastName")} errors={errors.lastName}>
            <Input id="lastName" name="lastName" defaultValue={values.lastName} required autoComplete="off" />
          </Field>
          <Field id="dateOfBirth" label={t("dateOfBirth")} errors={errors.dateOfBirth}>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={values.dateOfBirth} />
          </Field>
          <Field id="sex" label={t("sex")} errors={errors.sex}>
            <RefSelect
              name="sex"
              defaultValue={values.sex ?? "UNSPECIFIED"}
              options={[
                { id: "FEMALE", label: t("sexFEMALE") },
                { id: "MALE", label: t("sexMALE") },
                { id: "UNSPECIFIED", label: t("sexUNSPECIFIED") },
              ]}
            />
          </Field>

          <SectionTitle>{t("sectionContact")}</SectionTitle>
          <Field id="email" label={t("email")} errors={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={values.email} autoComplete="off" />
            <span className="text-[11px] text-pn-gray-3">{t("emailHint")}</span>
          </Field>
          <Field id="phone" label={t("phone")} errors={errors.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={values.phone} autoComplete="off" />
          </Field>
          <Field id="preferredLanguage" label={t("preferredLanguage")} errors={errors.preferredLanguage}>
            <RefSelect
              name="preferredLanguage"
              defaultValue={values.preferredLanguage ?? "fr"}
              options={[
                { id: "fr", label: "Français" },
                { id: "en", label: "English" },
              ]}
            />
          </Field>
          <Field id="countryId" label={t("country")} errors={errors.countryId}>
            <RefSelect name="countryId" defaultValue={values.countryId ?? ""} options={[{ id: "", label: t("none") }, ...options.countries]} />
          </Field>
          <Field id="city" label={t("city")} errors={errors.city}>
            <Input id="city" name="city" defaultValue={values.city} />
          </Field>

          <SectionTitle>{t("sectionHousehold")}</SectionTitle>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div role="radiogroup" aria-label={t("sectionHousehold")} className="flex flex-wrap gap-2">
              {[false, true].map((dep) => (
                <button
                  key={String(dep)}
                  type="button"
                  role="radio"
                  aria-checked={isDependent === dep}
                  onClick={() => setIsDependent(dep)}
                  className={`cursor-pointer border-2 px-3 py-1 text-xs font-semibold ${
                    isDependent === dep ? "border-pn-ink bg-pn-ink text-white" : "border-pn-border-muted hover:border-pn-ink"
                  }`}
                >
                  {dep ? t("isDependent") : t("isPrimary")}
                </button>
              ))}
            </div>
          </div>
          {isDependent && (
            <>
              <Field id="primaryMemberId" label={t("dependentOf")} errors={errors.primaryMemberId}>
                <RefSelect name="primaryMemberId" defaultValue={values.primaryMemberId} options={primaryOptions} placeholder={t("choosePrimary")} required />
              </Field>
              <Field id="relationshipId" label={t("relationship")} errors={errors.relationshipId}>
                <RefSelect name="relationshipId" defaultValue={values.relationshipId} options={options.relationships} placeholder={t("chooseRelationship")} required />
              </Field>
            </>
          )}

          <SectionTitle>{t("sectionCover")}</SectionTitle>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <input type="hidden" name="isCovered" value={isCovered ? "1" : "0"} />
            <div role="radiogroup" aria-label={t("coverStatus")} className="flex flex-wrap gap-2">
              {[true, false].map((covered) => (
                <button
                  key={String(covered)}
                  type="button"
                  role="radio"
                  aria-checked={isCovered === covered}
                  onClick={() => setIsCovered(covered)}
                  className={`cursor-pointer border-2 px-3 py-1 text-xs font-semibold ${
                    isCovered === covered ? "border-pn-ink bg-pn-ink text-white" : "border-pn-border-muted hover:border-pn-ink"
                  }`}
                >
                  {covered ? t("covered") : t("notCovered")}
                </button>
              ))}
            </div>
            {!isCovered && <span className="text-[11.5px] text-pn-gray-2">{t("notCoveredHint")}</span>}
          </div>
          <Field id="organizationId" label={t("organization")} errors={errors.organizationId} wide>
            {/* The empty option is how a group member is turned back into an
             * individual member — a Select can't otherwise be cleared. */}
            <RefSelect
              name="organizationId"
              defaultValue={values.organizationId ?? ""}
              options={[{ id: "", label: t("individualMember") }, ...options.organizations]}
            />
          </Field>
          <Field id="planName" label={t("planName")} errors={errors.planName}>
            <Input id="planName" name="planName" defaultValue={values.planName} />
          </Field>
          <Field id="policyNumber" label={t("policyNumber")} errors={errors.policyNumber}>
            <Input id="policyNumber" name="policyNumber" defaultValue={values.policyNumber} />
          </Field>
          <Field id="coverageStart" label={t("coverageStart")} errors={errors.coverageStart}>
            <Input id="coverageStart" name="coverageStart" type="date" defaultValue={values.coverageStart} />
          </Field>
          <Field id="coverageEnd" label={t("coverageEnd")} errors={errors.coverageEnd}>
            <Input id="coverageEnd" name="coverageEnd" type="date" defaultValue={values.coverageEnd} />
          </Field>

          <div className="pt-1 sm:col-span-2">
            <SubmitButton>{mode === "edit" ? t("save") : t("create")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
