import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentMember } from "@/lib/memberAuth";
import { redirect } from "@/i18n/navigation";
import { localizedText } from "@/lib/localizedText";
import { ageFromDateOfBirth } from "@/lib/memberNumber";
import { normalizeCallbackPhone } from "@/lib/phone";
import { requestablePeople } from "@/data/memberApp";
import { activeRequirementRules } from "@/data/medicationOrders";
import { EmergencyPanel } from "../../_components/emergency-panel";
import { OrderForm } from "./order-form";

/** Order medication: members choose from the catalog, add the documents
 * those items need, and say where to deliver. Nomad then asks pharmacies. */
export default async function OrderMedicationPage() {
  const t = await getTranslations("MemberOrder");
  const tm = await getTranslations("MemberApp");
  const locale = await getLocale();
  const member = (await getCurrentMember())!;
  // Someone not covered asks Nomad by phone (see the home page).
  if (!member.isCovered) redirect({ href: "/m", locale });
  const [people, rules] = await Promise.all([requestablePeople(member), activeRequirementRules()]);

  return (
    <main className="flex flex-col">
      <EmergencyPanel countryId={member.countryId} compact />
      <div className="flex flex-col gap-2 px-4 pt-6">
        <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        <p className="m-0 text-[15px] text-pn-gray-1">{t("intro")}</p>
      </div>
      <OrderForm
        people={people.map((p) => {
          const age = ageFromDateOfBirth(p.dateOfBirth);
          const relation = p.id === member.id ? tm("you") : p.relationship ? (localizedText(p.relationship.nameEn, p.relationship.nameFr, locale) ?? "") : "";
          return { id: p.id, name: `${p.firstName} ${p.lastName}`, detail: [relation, age !== null ? tm("ageYears", { age }) : null].filter(Boolean).join(" · ") };
        })}
        rules={rules.map((r) => ({
          code: r.code,
          name: localizedText(r.nameEn, r.nameFr, locale) ?? r.nameEn,
          description: localizedText(r.descriptionEn, r.descriptionFr, locale),
          appliesTo: r.appliesTo,
          kind: r.kind,
          sortOrder: r.sortOrder,
          isActive: r.isActive,
        }))}
        defaultPhone={member.phone ? (normalizeCallbackPhone(member.phone, member.country?.iso2?.trim() ?? "SN") ?? member.phone) : ""}
        defaultAddress={member.city ?? ""}
      />
    </main>
  );
}
