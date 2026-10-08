import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentMember } from "@/lib/memberAuth";
import { redirect } from "@/i18n/navigation";
import { localizedText } from "@/lib/localizedText";
import { ageFromDateOfBirth } from "@/lib/memberNumber";
import { normalizeCallbackPhone } from "@/lib/phone";
import { listActiveCaseCategories, requestablePeople } from "@/data/memberApp";
import { EmergencyPanel } from "../../_components/emergency-panel";
import { RequestForm } from "./request-form";
import { MemberSidebar } from "../../_components/member-sidebar";
import { MAIN_PANE, PANES } from "../../_components/panes";

export default async function RequestHelpPage() {
  const t = await getTranslations("MemberApp");
  const locale = await getLocale();
  const member = (await getCurrentMember())!;
  // Someone not covered asks Nomad by phone (see the home page).
  if (!member.isCovered) redirect({ href: "/m", locale });
  const [people, categories] = await Promise.all([requestablePeople(member), listActiveCaseCategories()]);

  return (
    <main className="flex flex-col">
      <EmergencyPanel countryId={member.countryId} compact />
      <div className={PANES}>
        <MemberSidebar member={member} active={{ kind: "request" }} className="hidden lg:flex" />
        <div className={MAIN_PANE}>
      <div className="flex flex-col gap-2 px-4 pt-6">
        <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.02em]">{t("requestHelp")}</h1>
      </div>
      <RequestForm
        people={people.map((p) => {
          const age = ageFromDateOfBirth(p.dateOfBirth);
          const relation = p.id === member.id ? t("you") : p.relationship ? (localizedText(p.relationship.nameEn, p.relationship.nameFr, locale) ?? "") : "";
          return { id: p.id, name: `${p.firstName} ${p.lastName}`, detail: [relation, age !== null ? t("ageYears", { age }) : null].filter(Boolean).join(" · ") };
        })}
        categories={categories.map((c) => ({ id: c.id, code: c.code, label: localizedText(c.nameEn, c.nameFr, locale) ?? c.nameEn }))}
        emergencyPanel={<EmergencyPanel countryId={member.countryId} />}
        // Pre-filled with the number on the member's record, formatted, so
        // they usually just confirm it.
        defaultPhone={member.phone ? (normalizeCallbackPhone(member.phone, member.country?.iso2?.trim() ?? "SN") ?? member.phone) : ""}
      />
        </div>
      </div>
    </main>
  );
}
