import { getLocale, getTranslations } from "next-intl/server";
import { Check, ChevronRight, LifeBuoy, MapPin, Phone, Pill } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CurrentMember } from "@/lib/memberAuth";
import { formatCaseNumber } from "@/lib/caseNumber";
import { formatDakarDate } from "@/lib/formatDate";
import { localizedText } from "@/lib/localizedText";
import { emergencyContactsFor, listMemberCases } from "@/data/memberApp";
import { getPrimaryAddress } from "@/data/memberAddresses";
import { memberFeatures } from "@/data/memberAppFeatures";
import { EmergencyPanel } from "./emergency-panel";
import { StatusChip } from "./status-chip";

export type SidebarActive = { kind: "home" } | { kind: "request" } | { kind: "order" } | { kind: "address" } | { kind: "case"; id: string };

/** The member's home content — greeting, "Request help" / "Order
 * medication", their requests and the emergency numbers. On a phone it is
 * the home page; on a computer it is the left column of every signed-in
 * page, with the open request or form highlighted. */
export async function MemberSidebar({ member, active, className = "" }: { member: CurrentMember; active: SidebarActive; className?: string }) {
  const t = await getTranslations("MemberApp");
  const locale = await getLocale();
  const [cases, contacts, primary, features] = await Promise.all([
    listMemberCases(member),
    member.isCovered ? null : emergencyContactsFor(member.countryId),
    getPrimaryAddress(member.id),
    memberFeatures(member),
  ]);
  const on = "lg:outline-2 lg:outline-offset-2 lg:outline-pn-ink lg:outline";

  return (
    <div className={`flex flex-col gap-6 px-4 py-6 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:self-start lg:overflow-y-auto lg:border-r lg:border-pn-rule lg:pr-6 lg:pl-0 ${className}`}>
      <h1 className={`m-0 leading-tight font-extrabold tracking-[-0.02em] ${active.kind === "home" ? "text-[26px]" : "text-[26px] lg:text-[22px]"}`}>{t("hello", { name: member.firstName })}</h1>

      <div className="flex flex-col gap-2">
        {features.REQUEST_HELP && (
          <Link
            href="/m/request"
            aria-current={active.kind === "request" ? "page" : undefined}
            className={`flex min-h-16 items-center justify-between gap-3 bg-pn-accent px-5 py-4 text-white no-underline hover:bg-pn-accent-hover active:bg-pn-accent-hover ${active.kind === "request" ? on : ""}`}
          >
            <span className="flex items-center gap-3">
              <LifeBuoy size={26} className="flex-none" aria-hidden />
              <span className="flex flex-col">
                <span className="text-[19px] font-extrabold">{t("requestHelp")}</span>
                <span className="text-[14px] opacity-90">{t("requestHelpSub")}</span>
              </span>
            </span>
            <ChevronRight size={22} className="flex-none" aria-hidden />
          </Link>
        )}
        {features.ORDER_MEDICATION && (
          <Link
            href="/m/order"
            aria-current={active.kind === "order" ? "page" : undefined}
            className={`flex min-h-16 items-center justify-between gap-3 border-2 border-pn-ink bg-white px-5 py-4 text-pn-ink no-underline hover:bg-pn-surface-hover active:bg-pn-surface-hover ${active.kind === "order" ? on : ""}`}
          >
            <span className="flex items-center gap-3">
              <Pill size={26} className="flex-none" aria-hidden />
              <span className="flex flex-col">
                <span className="text-[19px] font-extrabold">{t("orderMedication")}</span>
                <span className="text-[14px] text-pn-gray-1">{t("orderMedicationSub")}</span>
              </span>
            </span>
            <ChevronRight size={22} className="flex-none" aria-hidden />
          </Link>
        )}
      </div>
      {!member.isCovered && (
        // Not covered (e.g. a quick-start account): every request is a
        // special request — Nomad says what it costs before acting.
        <div className="flex flex-col gap-2 border-l-4 border-[#b45309] bg-white px-4 py-3">
          <p className="m-0 text-[15px] font-bold">{t("notCoveredTitle")}</p>
          <p className="m-0 text-[14px] text-pn-gray-1">{t(features.REQUEST_HELP ? "notCoveredBody" : "notCoveredBodyOrdersOnly")}</p>
          {contacts?.nomadNumbers.map((n) => (
            <a key={n.id} href={`tel:${n.phone.replace(/[^+\d]/g, "")}`} className="flex min-h-11 items-center gap-2 self-start border-2 border-pn-ink px-3 text-[15px] font-bold text-pn-ink no-underline">
              <Phone size={16} aria-hidden /> {t("callNomad", { phone: n.phone })}
            </a>
          ))}
        </div>
      )}

      {primary ? (
        <Link
          href="/m/address"
          aria-current={active.kind === "address" ? "page" : undefined}
          className={`flex items-start justify-between gap-3 border border-pn-rule bg-white px-4 py-3 text-pn-ink no-underline hover:border-pn-ink ${active.kind === "address" ? "border-l-4 border-pn-ink" : ""}`}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">
              <MapPin size={13} aria-hidden /> {t("primaryAddress")}
            </span>
            <span className="line-clamp-2 text-[14px]">{primary.addressText}</span>
            {primary.latitude !== null && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-[#0a5c3c]">
                <Check size={12} aria-hidden /> {t("locationSaved")}
              </span>
            )}
          </span>
          <span className="flex-none text-[13px] font-semibold text-[#0a5c3c]">{t("change")}</span>
        </Link>
      ) : (
        // A gentle reminder until the member saves one.
        <Link href="/m/address" className="flex items-center gap-3 border-2 border-dashed border-pn-ink bg-white px-4 py-3 text-pn-ink no-underline">
          <MapPin size={20} className="flex-none" aria-hidden />
          <span className="flex flex-col">
            <span className="text-[15px] font-bold">{t("addPrimaryAddress")}</span>
            <span className="text-[13px] text-pn-gray-1">{t("addPrimaryAddressWhy")}</span>
          </span>
          <ChevronRight size={18} className="ml-auto flex-none" aria-hidden />
        </Link>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-[13px] font-bold tracking-[0.08em] text-pn-gray-1 uppercase">{t("yourRequests")}</h2>
        {cases.length === 0 ? (
          <p className="m-0 text-[15px] text-pn-gray-2">{t("noRequests")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {cases.map((c) => {
              const current = active.kind === "case" && active.id === c.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/m/requests/${c.id}`}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 border px-4 py-3 text-pn-ink no-underline hover:border-pn-ink ${current ? "border-l-4 border-pn-ink bg-pn-accent-soft" : "border-pn-rule bg-white"}`}
                  >
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
              );
            })}
          </ul>
        )}
      </section>

      <EmergencyPanel countryId={member.countryId} />
    </div>
  );
}

/** What on the member's requests needs them: Nomad is waiting for an
 * answer, or there's a message they haven't read. */
export async function requestsNeedingMember(member: CurrentMember) {
  const cases = await listMemberCases(member);
  return cases.filter((c) => c.status === "WAITING_MEMBER" || (c.events[0] && (!c.memberLastSeenAt || c.events[0].createdAt > c.memberLastSeenAt)));
}
