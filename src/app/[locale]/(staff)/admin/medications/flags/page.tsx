import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireEditValueLists } from "@/lib/rbac";
import { canUseCopilot, copilotSettings, enabledTasks, pendingFlagSuggestions } from "@/data/copilot";
import { RegulatoryBadge } from "../_components/regulatory-badge";
import { decideFlagAction } from "../../copilot/actions";
import { SuggestFlagsButton } from "./suggest-button";

/** Admin > Medication catalog > AI flag suggestions: the copilot's
 * suggested regulatory class, prescription, cold chain and psychotropic
 * flags, one item at a time, for someone who edits the catalog to apply or
 * dismiss. Nothing changes in the catalog until "Apply". */
export default async function FlagSuggestionsPage() {
  const t = await getTranslations("CopilotFlags");
  const tm = await getTranslations("MedicationCatalog");
  const actor = await getCurrentActor();
  requireEditValueLists(actor);
  const [items, settings, tasks] = await Promise.all([pendingFlagSuggestions(), copilotSettings(), enabledTasks()]);
  const canAsk = canUseCopilot(actor) && tasks.CATALOG_FLAGS;
  const yes = (b: boolean) => (b ? t("yes") : t("no"));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-wrap items-end justify-between gap-4 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <div>
          <div className="text-xs text-pn-gray-2">
            <Link href="/admin/medications" className="hover:text-pn-ink">
              {tm("title")}
            </Link>{" "}
            /
          </div>
          <h1 className="m-0 flex items-center gap-2 text-[22px] font-extrabold tracking-[-0.02em]">
            <Sparkles size={20} className="text-[#5b21b6]" aria-hidden /> {t("title")}
          </h1>
          <p className="mt-1 max-w-[80ch] text-[12.5px] text-pn-gray-2">{t("intro")}</p>
        </div>
        {canAsk ? <SuggestFlagsButton batch={settings.CATALOG_BATCH_SIZE} /> : <p className="m-0 text-[12px] text-pn-gray-2">{t("notAvailable")}</p>}
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-pn-gray-2">{t("empty")}</p>
      ) : (
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b-2 border-pn-ink text-left text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
              <th className="px-5 py-2">{t("medication")}</th>
              <th className="px-2 py-2">{t("regulatoryClass")}</th>
              <th className="px-2 py-2">{t("prescription")}</th>
              <th className="px-2 py-2">{tm("coldChain")}</th>
              <th className="px-2 py-2">{tm("psychotropic")}</th>
              <th className="px-2 py-2">{t("why")}</th>
              <th className="px-5 py-2 text-right">{t("decision")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const m = s.medication;
              const changed = (now: unknown, next: unknown) => (now !== next ? "bg-[#f5f3ff] font-semibold" : "text-pn-gray-2");
              const cell = (now: boolean, next: boolean) => (
                <td className={`px-2 py-2 ${changed(now, next)}`}>
                  {yes(next)}
                  {now !== next && <span className="block text-[11px] font-normal text-pn-gray-2">{t("now", { value: yes(now) })}</span>}
                </td>
              );
              return (
                <tr key={s.id} className="border-b border-pn-rule align-top">
                  <td className="px-5 py-2">
                    <span className="block font-semibold">{[m.dci, m.strength, m.form].filter(Boolean).join(" ")}</span>
                    <span className="block text-[11.5px] text-pn-gray-2">{[m.brandName, m.code].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className={`px-2 py-2 ${changed(m.regulatoryClass, s.regulatoryClass)}`}>
                    <RegulatoryBadge value={s.regulatoryClass} label={tm(`class.${s.regulatoryClass}`)} />
                    {m.regulatoryClass !== s.regulatoryClass && <span className="block text-[11px] font-normal text-pn-gray-2">{t("now", { value: tm(`class.${m.regulatoryClass}`) })}</span>}
                  </td>
                  {cell(m.prescriptionRequired, s.prescriptionRequired)}
                  {cell(m.isColdChain, s.isColdChain)}
                  {cell(m.isPsychotropic, s.isPsychotropic)}
                  <td className="max-w-[360px] px-2 py-2">
                    <span className={`mr-1 inline-block px-1.5 text-[10.5px] font-bold uppercase ${s.confidence === "HIGH" ? "bg-pn-accent-soft text-[#08432c]" : s.confidence === "MEDIUM" ? "bg-[#fef3c7] text-[#92400e]" : "bg-pn-panel text-pn-gray-2"}`}>
                      {t(`confidence.${s.confidence}`)}
                    </span>
                    {s.reason}
                    {s.usage.provider === "mock" && <span className="block text-[11px] font-semibold text-[#b45309]">{t("testRow")}</span>}
                  </td>
                  <td className="px-5 py-2">
                    <form action={decideFlagAction} className="flex justify-end gap-1.5">
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" name="decision" value="apply" className="h-7 cursor-pointer bg-pn-accent px-2.5 text-[12px] font-semibold text-white hover:bg-pn-accent-hover">
                        {t("apply")}
                      </button>
                      <button type="submit" name="decision" value="dismiss" className="h-7 cursor-pointer border-2 border-pn-border-muted bg-white px-2.5 text-[12px] font-semibold hover:border-pn-ink">
                        {t("dismiss")}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
