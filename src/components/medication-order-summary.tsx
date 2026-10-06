import { getLocale, getTranslations } from "next-intl/server";
import { Check, FileText, MapPin, Snowflake, TriangleAlert } from "lucide-react";
import { localizedText } from "@/lib/localizedText";
import { activeRequirementRules, orderForCase } from "@/data/medicationOrders";

type Order = NonNullable<Awaited<ReturnType<typeof orderForCase>>>;

/** A medication order's contents — items, the documents provided for each
 * requirement, delivery — for the member's request page and the staff case
 * page. Documents open through the viewer's own protected file route. */
export async function MedicationOrderSummary({ order, viewer }: { order: Order; viewer: "member" | "staff" }) {
  const t = await getTranslations("MemberOrder");
  const locale = await getLocale();
  const rules = await activeRequirementRules();
  const ruleName = (code: string) => {
    const r = rules.find((x) => x.code === code);
    return r ? (localizedText(r.nameEn, r.nameFr, locale) ?? r.nameEn) : code;
  };
  const fileHref = (id: string) => (viewer === "member" ? `/api/m/files/${id}` : `/api/files/${id}`);
  const byRequirement = [...new Set(order.documents.map((d) => d.requirementCode))];
  const big = viewer === "member";

  return (
    <div className={`flex flex-col gap-3 ${big ? "text-[15px]" : "text-[13px]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-pn-ink px-2 py-0.5 text-[12px] font-bold text-white uppercase">{t(`status.${order.status}`)}</span>
        {order.hasNarcotic && <span className="bg-[#c62828] px-1.5 text-[11px] font-bold text-white">{t("badgeNarcotic")}</span>}
        {order.needsPrescription && !order.hasNarcotic && <span className="border border-pn-ink px-1.5 text-[11px] font-bold">{t("badgeRx")}</span>}
        {order.hasPsychotropic && <span className="bg-[#ede9fe] px-1.5 text-[11px] font-bold text-[#5b21b6]">{t("badgePsy")}</span>}
        {order.hasColdChain && (
          <span className="flex items-center gap-0.5 bg-[#e0f2fe] px-1.5 text-[11px] font-bold text-[#075985]">
            <Snowflake size={10} aria-hidden /> {t("badgeCold")}
          </span>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col border border-pn-rule bg-white p-0">
        {order.lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 border-b border-pn-rule px-3 py-2 last:border-b-0">
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{l.freeText ?? [l.dci, l.strength, l.form].filter(Boolean).join(" ")}</span>
              <span className={`${big ? "text-[13px]" : "text-[11.5px]"} text-pn-gray-2`}>
                {l.freeText ? t("notInList") : (l.brandName ?? "")}
                {l.regulatoryClass === "NARCOTIC" && <span className="ml-1.5 font-bold text-[#c62828]">{t("badgeNarcotic")}</span>}
                {l.isColdChain && <span className="ml-1.5 font-bold text-[#075985]">{t("badgeCold")}</span>}
              </span>
            </span>
            <span className="flex-none font-bold tabular-nums">× {l.quantity}</span>
          </li>
        ))}
      </ul>

      {(byRequirement.length > 0 || order.hasNarcotic) && (
        <div className="flex flex-col gap-1.5">
          <span className={`font-bold tracking-[0.06em] text-pn-gray-2 uppercase ${big ? "text-[12px]" : "text-[10.5px]"}`}>{t("documents")}</span>
          {byRequirement.map((code) => (
            <div key={code} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex items-center gap-1 font-semibold">
                <Check size={14} className="text-[#0a5c3c]" aria-hidden /> {ruleName(code)}:
              </span>
              {order.documents
                .filter((d) => d.requirementCode === code)
                .map((d, i) => (
                  <a key={d.id} href={fileHref(d.file.id)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-[#0a5c3c] underline">
                    <FileText size={13} aria-hidden /> {t("fileN", { n: i + 1 })}
                  </a>
                ))}
            </div>
          ))}
          {order.hasNarcotic && (
            <p className="m-0 flex items-start gap-1.5 text-[#991b1b]">
              <TriangleAlert size={15} className="mt-0.5 flex-none" aria-hidden /> {t("originalReminder")}
            </p>
          )}
        </div>
      )}

      <div className="flex items-start gap-1.5">
        <MapPin size={15} className="mt-0.5 flex-none" aria-hidden />
        <span>
          {order.deliveryAddress}
          {order.deliveryLatitude !== null && <span className="text-pn-gray-2"> · {t("locationShared")}</span>}
          {order.deliveryNotes && <span className="block text-pn-gray-2">{order.deliveryNotes}</span>}
        </span>
      </div>
      {order.memberNote && <p className="m-0 border-l-4 border-pn-border-muted pl-2 whitespace-pre-line">{order.memberNote}</p>}
    </div>
  );
}
