import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { UserCheck, UserX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireManageMembers } from "@/lib/rbac";
import { formatMemberNumber, ageFromDateOfBirth } from "@/lib/memberNumber";
import { localizedText } from "@/lib/localizedText";
import { getMemberWithHousehold } from "@/data/members";
import { PnTag } from "@/components/pn-tag";
import { MemberFormDialog, type MemberFormValues } from "../_components/member-form-dialog";
import { NotCoveredTag } from "../_components/not-covered-tag";
import { loadMemberFormOptions } from "../_components/form-options";
import { setMemberStatusAction } from "../actions";

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-pn-rule py-2 text-[13px] last:border-b-0">
      <dt className="text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children ?? <span className="text-pn-gray-3">—</span>}</dd>
    </div>
  );
}

export default async function MemberPage(props: PageProps<"/[locale]/members/[id]">) {
  const t = await getTranslations("Members");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireManageMembers(actor);

  const { id } = await props.params;
  const [data, formOptions] = await Promise.all([getMemberWithHousehold(id), loadMemberFormOptions()]);
  if (!data) notFound();
  const { member, household } = data;
  const age = ageFromDateOfBirth(member.dateOfBirth);
  const primary = household.find((h) => !h.primaryMemberId);
  const relName = (r: { nameEn: string; nameFr: string | null } | null) => (r ? (localizedText(r.nameEn, r.nameFr, locale) ?? r.nameEn) : null);

  const formValues: MemberFormValues = {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    dateOfBirth: isoDate(member.dateOfBirth),
    sex: member.sex,
    email: member.email ?? undefined,
    phone: member.phone ?? undefined,
    preferredLanguage: member.preferredLanguage,
    countryId: member.countryId ?? undefined,
    city: member.city ?? undefined,
    primaryMemberId: member.primaryMemberId ?? undefined,
    relationshipId: member.relationshipId ?? undefined,
    organizationId: member.organizationId ?? undefined,
    planName: member.planName ?? undefined,
    policyNumber: member.policyNumber ?? undefined,
    coverageStart: isoDate(member.coverageStart),
    coverageEnd: isoDate(member.coverageEnd),
    isCovered: member.isCovered,
  };
  // "Add dependent" starts from the primary member's household details.
  const dependentDefaults: MemberFormValues | null = primary
    ? {
        lastName: primary.lastName,
        primaryMemberId: primary.id,
        preferredLanguage: primary.preferredLanguage,
        countryId: primary.countryId ?? undefined,
        city: primary.city ?? undefined,
        organizationId: primary.organizationId ?? undefined,
        planName: primary.planName ?? undefined,
        policyNumber: primary.policyNumber ?? undefined,
        coverageStart: isoDate(primary.coverageStart),
        coverageEnd: isoDate(primary.coverageEnd),
        isCovered: primary.isCovered,
      }
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-wrap items-end justify-between gap-4 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.04em] text-pn-gray-3">
            <Link href="/members" className="hover:text-pn-ink">
              {t("title")}
            </Link>{" "}
            · <span className="tabular-nums">{formatMemberNumber(member.memberNumber)}</span>
          </div>
          <h1 className="mt-[5px] text-[24px] font-extrabold tracking-[-0.025em]">
            {member.firstName} {member.lastName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-pn-gray-2">
            <PnTag status={member.status} />
            <span className="border-2 border-pn-ink px-[7px] py-px text-[11px] font-semibold text-pn-ink">
              {member.primaryMemberId ? (relName(member.relationship) ?? t("dependent")) : t("primary")}
            </span>
            {member.organization ? <span>{member.organization.name}</span> : <span>{t("individual")}</span>}
            {!member.isCovered && <NotCoveredTag label={t("notCovered")} />}
            {age !== null && <span>· {t("ageYears", { age })}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Keyed on updatedAt so the form remounts with fresh values after
           * each save — otherwise its uncontrolled Selects get new default
           * values while mounted, which Base UI warns about (same fix as the
           * provider header's edit form). */}
          <MemberFormDialog key={member.updatedAt.getTime()} mode="edit" values={formValues} options={formOptions} />
          <form action={setMemberStatusAction}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="status" value={member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
            <button
              type="submit"
              className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-transparent px-3 text-xs font-semibold hover:bg-pn-surface-hover"
            >
              {member.status === "ACTIVE" ? <UserX size={13} /> : <UserCheck size={13} />}
              {member.status === "ACTIVE" ? t("deactivate") : t("reactivate")}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="m-0 border-b-2 border-pn-ink pb-1 text-[12px] font-bold tracking-[0.08em] uppercase">{t("details")}</h2>
          <dl className="m-0">
            <Row label={t("dateOfBirth")}>{member.dateOfBirth ? isoDate(member.dateOfBirth) : null}</Row>
            <Row label={t("sex")}>{t(`sex${member.sex}`)}</Row>
            <Row label={t("email")}>{member.email}</Row>
            <Row label={t("phone")}>{member.phone}</Row>
            <Row label={t("preferredLanguage")}>{member.preferredLanguage === "en" ? "English" : "Français"}</Row>
            <Row label={t("location")}>{[member.city, member.country?.name].filter(Boolean).join(", ") || null}</Row>
            <Row label={t("organization")}>{member.organization?.name ?? t("individual")}</Row>
            <Row label={t("planName")}>{member.planName}</Row>
            <Row label={t("policyNumber")}>{member.policyNumber}</Row>
            <Row label={t("coverage")}>
              {member.coverageStart || member.coverageEnd ? `${isoDate(member.coverageStart) ?? "…"} → ${isoDate(member.coverageEnd) ?? "…"}` : null}
            </Row>
          </dl>
          {member.primaryMemberId && !member.email && <p className="m-0 text-[12px] text-pn-gray-3">{t("noEmailNoSignIn")}</p>}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2 border-b-2 border-pn-ink pb-1">
            <h2 className="m-0 text-[12px] font-bold tracking-[0.08em] uppercase">{t("household", { count: household.length })}</h2>
            {dependentDefaults && <MemberFormDialog mode="addDependent" values={dependentDefaults} options={formOptions} />}
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {household.map((h) => {
              const hAge = ageFromDateOfBirth(h.dateOfBirth);
              const isCurrent = h.id === member.id;
              return (
                <li key={h.id} className={`flex flex-wrap items-center justify-between gap-2 border-b border-pn-rule py-2 ${isCurrent ? "bg-pn-surface-hover" : ""}`}>
                  <div className="min-w-0 px-1">
                    {isCurrent ? (
                      <span className="text-[13px] font-semibold">
                        {h.firstName} {h.lastName}
                      </span>
                    ) : (
                      <Link href={`/members/${h.id}`} className="text-[13px] font-semibold hover:underline">
                        {h.firstName} {h.lastName}
                      </Link>
                    )}
                    <div className="text-[11.5px] text-pn-gray-2">
                      {h.primaryMemberId ? (relName(h.relationship) ?? t("dependent")) : t("primary")}
                      {hAge !== null && ` · ${t("ageYears", { age: hAge })}`} · <span className="tabular-nums">{formatMemberNumber(h.memberNumber)}</span>
                    </div>
                  </div>
                  <PnTag status={h.status} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
