import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentMember } from "@/lib/memberAuth";
import { formatCaseNumber } from "@/lib/caseNumber";
import { formatDakarDateTime } from "@/lib/formatDate";
import { localizedText } from "@/lib/localizedText";
import { getMemberCase } from "@/data/memberApp";
import { EmergencyPanel } from "../../../_components/emergency-panel";
import { StatusChip } from "../../../_components/status-chip";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-pn-rule py-3 last:border-b-0">
      <dt className="text-[12px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{label}</dt>
      <dd className="m-0 text-[15px] break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

export default async function MemberRequestPage(props: PageProps<"/[locale]/m/requests/[id]">) {
  const t = await getTranslations("MemberApp");
  const locale = await getLocale();
  const member = (await getCurrentMember())!;
  const { id } = await props.params;
  const { sent } = await props.searchParams;
  const request = await getMemberCase(member, id);
  if (!request) notFound();

  return (
    <main className="flex flex-col">
      <EmergencyPanel countryId={member.countryId} compact />
      <div className="flex flex-col gap-5 px-4 py-6">
        {sent === "1" && (
          <div role="status" className="flex flex-col gap-1 border-2 border-pn-accent bg-pn-accent-soft p-4">
            <div className="flex items-center gap-2 text-[17px] font-bold text-[#08432c]">
              <CheckCircle2 size={20} aria-hidden /> {t("sentTitle")}
            </div>
            <p className="m-0 text-[15px]">{t("sentBody")}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{localizedText(request.category.nameEn, request.category.nameFr, locale)}</h1>
          <StatusChip status={request.status} />
        </div>
        <dl className="m-0 border border-pn-rule bg-white px-4">
          <Row label={t("reference")}>{formatCaseNumber(request.caseNumber)}</Row>
          <Row label={t("forWhom")}>
            {request.patient.firstName} {request.patient.lastName}
          </Row>
          <Row label={t("sentOn")}>{formatDakarDateTime(request.createdAt, locale)}</Row>
          <Row label={t("howUrgent")}>{t(`urgency.${request.urgency}`)}</Row>
          <Row label={t("whatYouToldUs")}>{request.description}</Row>
          <Row label={t("callbackNumber")}>
            {request.contactPhone}
            {request.contactHasWhatsapp && <span className="ml-2 text-[13px] font-semibold text-[#0b5a30]">{t("alsoOnWhatsapp")}</span>}
          </Row>
          <Row label={t("location")}>
            {[request.locationLabel, request.latitude !== null ? t("locationShared") : null].filter(Boolean).join(" · ") || t("noLocation")}
          </Row>
        </dl>
        <p className="m-0 text-[14px] text-pn-gray-1">{t("whatHappensNext")}</p>
        {request.urgency === "EMERGENCY" && <EmergencyPanel countryId={member.countryId} />}
        <Link href="/m" className="flex h-12 items-center justify-center border-2 border-pn-ink bg-white text-[16px] font-bold text-pn-ink no-underline">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
