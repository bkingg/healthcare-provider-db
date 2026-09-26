import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentMember } from "@/lib/memberAuth";
import { formatCaseNumber } from "@/lib/caseNumber";
import { formatDakarDate } from "@/lib/formatDate";
import { localizedText } from "@/lib/localizedText";
import { listMemberCases } from "@/data/memberApp";
import { EmergencyPanel } from "../_components/emergency-panel";
import { StatusChip } from "../_components/status-chip";

export default async function MemberHomePage() {
  const t = await getTranslations("MemberApp");
  const locale = await getLocale();
  const member = (await getCurrentMember())!;
  const cases = await listMemberCases(member);

  return (
    <main className="flex flex-col">
      <EmergencyPanel countryId={member.countryId} compact />
      <div className="flex flex-col gap-6 px-4 py-6">
        <h1 className="m-0 text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{t("hello", { name: member.firstName })}</h1>

        <Link href="/m/request" className="flex min-h-16 items-center justify-between gap-3 bg-pn-accent px-5 py-4 text-white no-underline active:bg-pn-accent-hover">
          <span className="flex items-center gap-3">
            <LifeBuoy size={26} aria-hidden />
            <span className="flex flex-col">
              <span className="text-[19px] font-extrabold">{t("requestHelp")}</span>
              <span className="text-[14px] opacity-90">{t("requestHelpSub")}</span>
            </span>
          </span>
          <ChevronRight size={22} aria-hidden />
        </Link>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[13px] font-bold tracking-[0.08em] text-pn-gray-1 uppercase">{t("yourRequests")}</h2>
          {cases.length === 0 ? (
            <p className="m-0 text-[15px] text-pn-gray-2">{t("noRequests")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link href={`/m/requests/${c.id}`} className="flex items-center justify-between gap-3 border border-pn-rule bg-white px-4 py-3 text-pn-ink no-underline">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold">{localizedText(c.category.nameEn, c.category.nameFr, locale)}</span>
                      <span className="text-[13px] text-pn-gray-2">
                        {c.patient.firstName} · {formatDakarDate(c.createdAt, locale)} · {formatCaseNumber(c.caseNumber)}
                      </span>
                    </span>
                    <span className="flex flex-none flex-col items-end gap-1">
                      <StatusChip status={c.status} />
                      {c.events[0] && (!c.memberLastSeenAt || c.events[0].createdAt > c.memberLastSeenAt) && (
                        <span className="bg-[#1d4ed8] px-1.5 text-[11px] font-bold text-white">{t("newMessage")}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <EmergencyPanel countryId={member.countryId} />
      </div>
    </main>
  );
}
