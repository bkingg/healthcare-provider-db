import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentMember } from "@/lib/memberAuth";
import { formatMemberNumber, ageFromDateOfBirth } from "@/lib/memberNumber";
import { formatDakarDate } from "@/lib/formatDate";
import { localizedText } from "@/lib/localizedText";
import { getMemberProfile } from "@/data/memberApp";
import { getPrimaryAddress } from "@/data/memberAddresses";
import { EmergencyPanel } from "../../_components/emergency-panel";
import { MemberSidebar } from "../../_components/member-sidebar";
import { MAIN_PANE, PANES } from "../../_components/panes";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-pn-rule py-3 last:border-b-0">
      <dt className="text-[12px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{label}</dt>
      <dd className="m-0 text-[15px] break-words">{children ?? <span className="text-pn-gray-3">—</span>}</dd>
    </div>
  );
}

/** The member's own details, read-only: staff keep member records, so
 * changes go through Nomad. The primary address is the member's to edit. */
export default async function MemberProfilePage() {
  const t = await getTranslations("MemberProfile");
  const locale = await getLocale();
  const member = (await getCurrentMember())!;
  const [p, address] = await Promise.all([getMemberProfile(member), getPrimaryAddress(member.id)]);
  const date = (d: Date | null) => (d ? formatDakarDate(d, locale) : null);
  const section = "m-0 text-[13px] font-bold tracking-[0.08em] text-pn-gray-1 uppercase";

  return (
    <main className="flex flex-col">
      <EmergencyPanel countryId={member.countryId} compact />
      <div className={PANES}>
        <MemberSidebar member={member} active={{ kind: "profile" }} className="hidden lg:flex" />
        <div className={`flex flex-col gap-5 px-4 py-6 ${MAIN_PANE}`}>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.02em]">
              {p.firstName} {p.lastName}
            </h1>
            <span className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className="text-pn-gray-2 tabular-nums">{formatMemberNumber(p.memberNumber)}</span>
              <span className={`px-2 py-0.5 text-[12px] font-bold ${p.isCovered ? "bg-pn-accent-soft text-[#08432c]" : "bg-[#fcefd9] text-[#7a3d06]"}`}>{p.isCovered ? t("covered") : t("notCovered")}</span>
            </span>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className={section}>{t("details")}</h2>
            <dl className="m-0 border border-pn-rule bg-white px-4">
              <Row label={t("dateOfBirth")}>{date(p.dateOfBirth)}</Row>
              <Row label={t("phone")}>{p.phone}</Row>
              <Row label={t("email")}>{p.email}</Row>
              <Row label={t("language")}>{p.preferredLanguage === "en" ? "English" : "Français"}</Row>
              <Row label={t("location")}>{[p.city, p.country?.name].filter(Boolean).join(", ") || null}</Row>
            </dl>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className={section}>{t("cover")}</h2>
            {p.isCovered ? (
              <dl className="m-0 border border-pn-rule bg-white px-4">
                <Row label={t("organization")}>{p.organization?.name ?? t("individual")}</Row>
                <Row label={t("plan")}>{p.planName}</Row>
                <Row label={t("policyNumber")}>{p.policyNumber}</Row>
                <Row label={t("coverDates")}>{p.coverageStart || p.coverageEnd ? `${date(p.coverageStart) ?? "…"} → ${date(p.coverageEnd) ?? "…"}` : null}</Row>
              </dl>
            ) : (
              <p className="m-0 border-l-4 border-[#b45309] bg-white px-4 py-3 text-[14px]">{t("notCoveredBody")}</p>
            )}
          </section>

          {(p.primaryMember || p.dependents.length > 0) && (
            <section className="flex flex-col gap-2">
              <h2 className={section}>{t("household")}</h2>
              {p.primaryMember ? (
                <p className="m-0 border border-pn-rule bg-white px-4 py-3 text-[15px]">{t("onMembershipOf", { name: `${p.primaryMember.firstName} ${p.primaryMember.lastName}` })}</p>
              ) : (
                <ul className="m-0 flex list-none flex-col border border-pn-rule bg-white p-0">
                  {p.dependents.map((d) => {
                    const age = ageFromDateOfBirth(d.dateOfBirth);
                    return (
                      <li key={d.id} className="flex flex-col border-b border-pn-rule px-4 py-3 last:border-b-0">
                        <span className="text-[15px] font-semibold">
                          {d.firstName} {d.lastName}
                        </span>
                        <span className="text-[13px] text-pn-gray-2">
                          {[d.relationship ? localizedText(d.relationship.nameEn, d.relationship.nameFr, locale) : null, age !== null ? t("ageYears", { age }) : null, formatMemberNumber(d.memberNumber)].filter(Boolean).join(" · ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className={section}>{t("primaryAddress")}</h2>
            <Link href="/m/address" className="flex items-center justify-between gap-3 border border-pn-rule bg-white px-4 py-3 text-pn-ink no-underline hover:border-pn-ink">
              <span className="flex min-w-0 items-start gap-2">
                <MapPin size={18} className="mt-0.5 flex-none" aria-hidden />
                <span className="text-[15px]">{address ? address.addressText : t("noAddress")}</span>
              </span>
              <span className="flex flex-none items-center gap-1 text-[14px] font-semibold text-[#0a5c3c]">
                {address ? t("change") : t("add")} <ChevronRight size={16} aria-hidden />
              </span>
            </Link>
          </section>

          <p className="m-0 text-[14px] text-pn-gray-1">{t("changesNote")}</p>
        </div>
      </div>
    </main>
  );
}
