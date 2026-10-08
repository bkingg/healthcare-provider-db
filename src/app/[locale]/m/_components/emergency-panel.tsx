import { getLocale, getTranslations } from "next-intl/server";
import { Ambulance, Phone, Siren } from "lucide-react";
import { localizedText } from "@/lib/localizedText";
import { emergencyContactsFor } from "@/data/memberApp";

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

/** The emergency numbers, always within reach in the member app: public
 * emergency services first (for anything life-threatening), then private
 * 24/7 ambulances, then Nomad's own line. `compact` is the slim version for the top of every screen. */
export async function EmergencyPanel({ countryId, compact = false }: { countryId: string | null | undefined; compact?: boolean }) {
  const t = await getTranslations("MemberApp");
  const locale = await getLocale();
  const { publicNumbers, privateNumbers, nomadNumbers } = await emergencyContactsFor(countryId);
  const label = (c: { labelEn: string; labelFr: string | null }) => localizedText(c.labelEn, c.labelFr, locale) ?? c.labelEn;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#b91c1c] px-4 py-2 text-[14px] text-white">
        <Siren size={16} aria-hidden className="flex-none" />
        <span className="font-semibold">{t("emergencyStrip")}</span>
        {publicNumbers.length > 0 ? (
          publicNumbers.map((c) => (
            <a key={c.id} href={telHref(c.phone)} className="font-bold whitespace-nowrap underline underline-offset-2">
              {label(c)} {c.phone}
            </a>
          ))
        ) : (
          <span>{t("callLocalEmergency")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-col gap-2 border-2 border-[#b91c1c] bg-[#fdf2f2] p-4">
        <div className="flex items-center gap-2 text-[16px] font-bold text-[#991b1b]">
          <Siren size={20} aria-hidden /> {t("lifeThreatening")}
        </div>
        <p className="m-0 text-[15px] text-[#3f0d0d]">{t("lifeThreateningHelp")}</p>
        {publicNumbers.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 @lg:grid-cols-3">
            {publicNumbers.map((c) => (
              <a
                key={c.id}
                href={telHref(c.phone)}
                className="flex min-h-12 items-center justify-between gap-2 bg-[#b91c1c] px-4 py-2 text-white no-underline active:bg-[#991b1b]"
              >
                <span className="text-[15px] font-semibold">{label(c)}</span>
                <span className="flex items-center gap-1.5 text-[20px] font-extrabold tabular-nums">
                  <Phone size={16} aria-hidden /> {c.phone}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[15px] font-semibold">{t("callLocalEmergency")}</p>
        )}
      </div>
      {privateNumbers.length > 0 && (
        <div className="flex flex-col gap-2 border-2 border-pn-ink bg-white p-4">
          <div className="flex items-center gap-2 text-[16px] font-bold">
            <Ambulance size={20} aria-hidden /> {t("privateAmbulances")}
          </div>
          <p className="m-0 text-[14px] text-pn-gray-1">{t("privateAmbulancesHelp")}</p>
          <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2">
            {privateNumbers.map((c) => (
              <a key={c.id} href={telHref(c.phone)} className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-2 border-[#b91c1c] bg-white px-4 py-2 text-[#991b1b] no-underline active:bg-[#fdf2f2]">
                <span className="text-[15px] font-semibold">{label(c)}</span>
                <span className="flex items-center gap-1.5 text-[16px] font-extrabold whitespace-nowrap tabular-nums">
                  <Phone size={15} aria-hidden /> {c.phone}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
      {nomadNumbers.map((c) => (
        <a key={c.id} href={telHref(c.phone)} className="flex min-h-12 items-center justify-between gap-2 border-2 border-pn-ink bg-white px-4 py-2 text-pn-ink no-underline">
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{label(c)}</span>
            <span className="text-[13px] text-pn-gray-2">{t("nomadLineHelp")}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[17px] font-bold whitespace-nowrap tabular-nums">
            <Phone size={15} aria-hidden /> {c.phone}
          </span>
        </a>
      ))}
    </div>
  );
}
