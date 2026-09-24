import { getTranslations } from "next-intl/server";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireManageMembers } from "@/lib/rbac";
import { MemberImportForm } from "./member-import-form";

export default async function MemberImportPage() {
  const t = await getTranslations("MemberImport");
  const actor = await getCurrentActor();
  requireManageMembers(actor);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex-none border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <div className="text-[11px] tracking-[0.04em] text-pn-gray-3">
          <Link href="/members" className="hover:text-pn-ink">
            {t("breadcrumb")}
          </Link>
        </div>
        <h1 className="mt-[5px] text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        <p className="mt-1 max-w-[70ch] text-[12.5px] text-pn-gray-2">{t("intro")}</p>
      </div>

      <div className="flex max-w-5xl flex-col gap-6 px-5 py-5">
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[12px] font-bold tracking-[0.08em] uppercase">{t("step1")}</h2>
          <p className="m-0 max-w-[70ch] text-[12.5px] text-pn-gray-2">{t("step1Help")}</p>
          <div className="flex flex-wrap gap-2">
            {/* Plain links, not <Link>: the route streams a file download
             * (same as the report downloads). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/members/template?format=xlsx" className="flex h-8 items-center gap-[7px] border-2 border-pn-ink px-3 text-xs font-semibold hover:bg-pn-surface-hover">
              <FileSpreadsheet size={14} /> {t("downloadXlsx")}
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/members/template?format=csv" className="flex h-8 items-center gap-[7px] border-2 border-pn-border-muted px-3 text-xs font-semibold hover:border-pn-ink">
              <FileText size={14} /> {t("downloadCsv")}
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[12px] font-bold tracking-[0.08em] uppercase">{t("step2")}</h2>
          <MemberImportForm />
        </section>
      </div>
    </div>
  );
}
