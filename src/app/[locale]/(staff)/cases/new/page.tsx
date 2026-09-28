import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireWorkCases } from "@/lib/rbac";
import { localizedText } from "@/lib/localizedText";
import { listCaseWorkers } from "@/data/caseOps";
import { listActiveCaseCategories } from "@/data/memberApp";
import { listCountries } from "@/data/referenceData";
import { NewCaseForm } from "../_components/new-case-form";

/** Opening a case for a member who phoned, emailed, sent a WhatsApp or
 * walked in — or a special request for someone not covered. */
export default async function NewCasePage() {
  const t = await getTranslations("Cases");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireWorkCases(actor);
  const [categories, workers, countries] = await Promise.all([listActiveCaseCategories(), listCaseWorkers(), listCountries()]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-col gap-1 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <Link href="/cases" className="flex w-fit items-center gap-1 text-[11px] tracking-[0.04em] text-pn-gray-3 hover:text-pn-ink">
          <ArrowLeft size={12} aria-hidden /> {t("title")}
        </Link>
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("newCase.title")}</h1>
        <p className="m-0 text-[12.5px] text-pn-gray-2">{t("newCase.subtitle")}</p>
      </div>
      <NewCaseForm
        categories={categories.map((c) => ({ id: c.id, code: c.code, label: localizedText(c.nameEn, c.nameFr, locale) ?? c.nameEn }))}
        workers={workers}
        meId={actor.id}
        countries={countries.map((c) => ({ id: c.id, label: c.name, iso2: c.iso2?.trim() ?? null }))}
      />
    </div>
  );
}
