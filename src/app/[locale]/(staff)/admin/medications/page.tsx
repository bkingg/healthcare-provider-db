import { getTranslations } from "next-intl/server";
import { FileUp, Snowflake } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireEditValueLists } from "@/lib/rbac";
import { REGULATORY_CLASSES, type RegulatoryClass } from "@/lib/medications";
import { searchMedications, type CatalogFilters } from "@/data/medications";
import { MedicationDialog } from "./_components/medication-dialog";
import { RegulatoryBadge } from "./_components/regulatory-badge";
import { setMedicationActiveAction } from "./actions";

function parseFilters(raw: Record<string, string | string[] | undefined>): CatalogFilters {
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const cls = one("class");
  const status = one("status");
  const sample = one("sample");
  return {
    q: one("q")?.trim() || undefined,
    regulatoryClass: REGULATORY_CLASSES.includes(cls as RegulatoryClass) ? (cls as RegulatoryClass) : undefined,
    coldChain: one("cold") === "1",
    psychotropic: one("psy") === "1",
    status: status === "INACTIVE" || status === "ALL" ? status : "ACTIVE",
    sample: sample === "ONLY" || sample === "HIDE" ? sample : undefined,
  };
}

/** Admin > Medication catalog: what members will order from. Loaded by
 * import (a standardized list such as the LNMPE), with the flags Nomad adds
 * — regulatory class, psychotropic, cold chain, prescription. */
export default async function MedicationCatalogPage(props: PageProps<"/[locale]/admin/medications">) {
  const t = await getTranslations("MedicationCatalog");
  const actor = await getCurrentActor();
  requireEditValueLists(actor);
  const filters = parseFilters(await props.searchParams);
  const { items, total, limit, samples } = await searchMedications(filters);
  const selectClass = "h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case";
  const labelClass = "flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-wrap items-end justify-between gap-4 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
          <p className="mt-1 max-w-[75ch] text-[12.5px] text-pn-gray-2">{t("intro")}</p>
          <div className="mt-1 text-xs text-pn-gray-2">
            <strong className="text-pn-ink tabular-nums">{total.toLocaleString()}</strong> {t("results")}
            {total > limit && <span className="ml-2 font-semibold text-pn-accent">{t("showingFirst", { limit })}</span>}
            {samples > 0 && <span className="ml-2 bg-[#fff4d6] px-1.5 font-semibold text-[#92400e]">{t("samplesNote", { count: samples })}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/medications/import" className="flex h-8 items-center gap-[7px] border-2 border-pn-ink px-3 text-xs font-semibold no-underline hover:bg-pn-surface-hover">
            <FileUp size={14} /> {t("import")}
          </Link>
          <MedicationDialog mode="create" />
        </div>
      </div>

      <form method="get" className="flex flex-none flex-wrap items-end gap-2 border-b border-pn-rule px-5 py-3">
        <label className={`${labelClass} min-w-[220px]`}>
          {t("search")}
          <input name="q" defaultValue={filters.q ?? ""} placeholder={t("searchPlaceholder")} className={`${selectClass} w-full`} />
        </label>
        <label className={labelClass}>
          {t("regulatoryClass")}
          <select name="class" defaultValue={filters.regulatoryClass ?? ""} className={selectClass}>
            <option value="">{t("any")}</option>
            {REGULATORY_CLASSES.map((c) => (
              <option key={c} value={c}>
                {t(`class.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("status")}
          <select name="status" defaultValue={filters.status} className={selectClass}>
            <option value="ACTIVE">{t("statusActive")}</option>
            <option value="INACTIVE">{t("statusInactive")}</option>
            <option value="ALL">{t("statusAll")}</option>
          </select>
        </label>
        <label className={labelClass}>
          {t("sampleFilter")}
          <select name="sample" defaultValue={filters.sample ?? ""} className={selectClass}>
            <option value="">{t("any")}</option>
            <option value="ONLY">{t("sampleOnly")}</option>
            <option value="HIDE">{t("sampleHide")}</option>
          </select>
        </label>
        <label className="flex h-8 cursor-pointer items-center gap-1.5 text-[13px]">
          <input type="checkbox" name="cold" value="1" defaultChecked={filters.coldChain} className="h-4 w-4 accent-pn-ink" /> {t("coldChain")}
        </label>
        <label className="flex h-8 cursor-pointer items-center gap-1.5 text-[13px]">
          <input type="checkbox" name="psy" value="1" defaultChecked={filters.psychotropic} className="h-4 w-4 accent-pn-ink" /> {t("psychotropic")}
        </label>
        <button type="submit" className="h-8 cursor-pointer border-2 border-pn-ink bg-pn-ink px-4 text-xs font-semibold text-white">
          {t("apply")}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b-2 border-pn-ink bg-pn-panel text-left text-[10px] font-bold tracking-[0.07em] text-pn-gray-1 uppercase">
              <th className="px-5 py-2">{t("colMedication")}</th>
              <th className="px-3 py-2">{t("colBrand")}</th>
              <th className="px-3 py-2">{t("colClass")}</th>
              <th className="px-3 py-2">{t("colFlags")}</th>
              <th className="px-3 py-2">{t("colSource")}</th>
              <th className="px-3 py-2">{t("status")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className={`border-b border-pn-rule align-top hover:bg-pn-surface-hover ${m.isActive ? "" : "text-pn-gray-3"}`}>
                <td className="px-5 py-2">
                  <div className="font-semibold">
                    {m.dci} {m.strength && <span className="font-normal">{m.strength}</span>}
                  </div>
                  <div className="text-[11.5px] text-pn-gray-2">
                    {[m.form, m.presentation].filter(Boolean).join(" · ")} <span className="text-pn-gray-3 tabular-nums">· {m.code}</span>
                  </div>
                </td>
                <td className="px-3 py-2">{m.brandName ?? "—"}</td>
                <td className="px-3 py-2">
                  <RegulatoryBadge value={m.regulatoryClass} label={t(`class.${m.regulatoryClass}`)} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {m.prescriptionRequired && <span className="border border-pn-ink px-1 text-[10.5px] font-bold">{t("flagRx")}</span>}
                    {m.isPsychotropic && <span className="bg-[#ede9fe] px-1 text-[10.5px] font-bold text-[#5b21b6]">{t("flagPsy")}</span>}
                    {m.isColdChain && (
                      <span className="flex items-center gap-0.5 bg-[#e0f2fe] px-1 text-[10.5px] font-bold text-[#075985]">
                        <Snowflake size={10} aria-hidden /> {t("flagCold")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-pn-gray-2">
                  {m.source ?? "—"}
                  {m.isSample && <span className="ml-1.5 bg-[#fff4d6] px-1 text-[10.5px] font-bold text-[#92400e]">{t("sample")}</span>}
                </td>
                <td className="px-3 py-2">{m.isActive ? t("statusActive") : t("statusInactive")}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <MedicationDialog
                      mode="edit"
                      values={{
                        id: m.id,
                        code: m.code,
                        dci: m.dci,
                        brandName: m.brandName ?? "",
                        strength: m.strength ?? "",
                        form: m.form,
                        presentation: m.presentation ?? "",
                        therapeuticClass: m.therapeuticClass ?? "",
                        regulatoryClass: m.regulatoryClass,
                        isPsychotropic: m.isPsychotropic,
                        isColdChain: m.isColdChain,
                        prescriptionRequired: m.prescriptionRequired,
                        source: m.source ?? "",
                      }}
                    />
                    <form action={setMedicationActiveAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="isActive" value={String(!m.isActive)} />
                      <button type="submit" className="cursor-pointer text-[12px] font-semibold text-pn-gray-2 hover:text-pn-ink hover:underline">
                        {m.isActive ? t("deactivate") : t("activate")}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-pn-gray-3">
                  {filters.q || filters.regulatoryClass ? t("noResults") : t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
