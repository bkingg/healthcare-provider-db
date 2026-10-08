import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentMember } from "@/lib/memberAuth";
import { formatCaseNumber } from "@/lib/caseNumber";
import { localizedText } from "@/lib/localizedText";
import { EmergencyPanel } from "../_components/emergency-panel";
import { MemberSidebar, requestsNeedingMember } from "../_components/member-sidebar";
import { PANES } from "../_components/panes";

export default async function MemberHomePage() {
  const t = await getTranslations("MemberApp");
  const locale = await getLocale();
  const member = (await getCurrentMember())!;
  const attention = await requestsNeedingMember(member);

  return (
    <main className="flex flex-col">
      <EmergencyPanel countryId={member.countryId} compact />
      <div className={PANES}>
        <MemberSidebar member={member} active={{ kind: "home" }} />
        {/* Computer only: the right-hand pane before a request is opened. */}
        <section className="hidden flex-col gap-4 px-4 py-6 lg:flex">
          <h2 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("desktopWelcomeTitle")}</h2>
          <p className="m-0 max-w-prose text-[15px] text-pn-gray-1">{t("desktopWelcomeBody")}</p>
          {attention.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-bold tracking-[0.08em] text-pn-gray-1 uppercase">{t("needsYou")}</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {attention.map((c) => (
                  <li key={c.id}>
                    <Link href={`/m/requests/${c.id}`} className="flex items-center justify-between gap-3 border-l-4 border-[#b45309] bg-white px-4 py-3 text-pn-ink no-underline hover:bg-pn-surface-hover">
                      <span className="flex flex-col">
                        <span className="text-[15px] font-semibold">{localizedText(c.category.nameEn, c.category.nameFr, locale)}</span>
                        <span className="text-[13px] text-pn-gray-2">
                          {c.patient.firstName} · {formatCaseNumber(c.caseNumber)} · {c.status === "WAITING_MEMBER" ? t("status.WAITING_MEMBER") : t("newMessage")}
                        </span>
                      </span>
                      <ChevronRight size={18} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="m-0 border-l-4 border-pn-accent bg-white px-4 py-3 text-[15px]">{t("allCaughtUp")}</p>
          )}
        </section>
      </div>
    </main>
  );
}
