import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { getCurrentActor } from "@/lib/actor";
import { requireViewReports } from "@/lib/rbac";
import { getProviderStatusCounts, getValidatedPerMonth, getValidationCounts } from "@/data/reports";
import { PnTag } from "@/components/pn-tag";

export default async function ReportsAdminPage() {
  const t = await getTranslations("Admin");
  const actor = await getCurrentActor();
  requireViewReports(actor);

  const locale = await getLocale();
  const [statusCounts, validation, perMonth] = await Promise.all([
    getProviderStatusCounts(),
    getValidationCounts(),
    getValidatedPerMonth(12),
  ]);
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const monthLabel = (key: string) => monthFmt.format(new Date(`${key}-01T00:00:00Z`));
  const maxCount = Math.max(...perMonth.map((m) => m.count), 1);
  const total = statusCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("reportsTitle")}</h1>
        <p className="mt-[5px] text-xs text-pn-gray-2">{t("reportsSubtitle")}</p>
      </div>

      <div className="border-2 border-pn-ink p-4">
        <div className="mb-3 text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("providersByStatus")}</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="border-2 border-pn-ink px-3 py-1.5">
            <div className="text-[10px] tracking-[0.05em] text-pn-gray-3 uppercase">{t("totalProviders")}</div>
            <div className="text-lg font-extrabold tabular-nums">{total}</div>
          </div>
          <div className="border-2 border-pn-accent px-3 py-1.5">
            <div className="text-[10px] tracking-[0.05em] text-pn-gray-3 uppercase">{t("validatedProviders")}</div>
            <div className="text-lg font-extrabold tabular-nums">{validation.validated}</div>
          </div>
          <div className="border-2 border-pn-ink px-3 py-1.5">
            <div className="text-[10px] tracking-[0.05em] text-pn-gray-3 uppercase">{t("notValidatedProviders")}</div>
            <div className="text-lg font-extrabold tabular-nums">{validation.notValidated}</div>
          </div>
          {statusCounts.map((s) => (
            <div key={s.status} className="flex flex-col items-start gap-1">
              <PnTag status={s.status} />
              <span className="text-sm font-semibold tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="m-0 -mb-3 text-xs font-extrabold tracking-[0.09em] uppercase">{t("downloadableReports")}</h2>

      <div className="border-2 border-pn-ink p-4">
        <div className="mb-1 text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("providerMainReport")}</div>
        <p className="mb-3 text-xs text-pn-gray-2">{t("providerMainReportHint")}</p>
        {/* Plain <a>, not next-intl's Link: this downloads a binary file
         * from an API route (Content-Disposition: attachment), not a page
         * transition, so client-side routing doesn't apply here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/reports/providers"
          className="flex h-8 w-fit cursor-pointer items-center gap-[7px] border-none bg-pn-accent px-3 text-xs font-semibold text-white hover:bg-pn-accent-hover"
        >
          <Download size={14} /> {t("downloadProviderReport")}
        </a>
      </div>

      <div className="border-2 border-pn-ink p-4">
        <div className="mb-1 text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("adminContactReport")}</div>
        <p className="mb-3 text-xs text-pn-gray-2">{t("adminContactReportHint")}</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/reports/admin-contacts"
          className="flex h-8 w-fit cursor-pointer items-center gap-[7px] border-none bg-pn-accent px-3 text-xs font-semibold text-white hover:bg-pn-accent-hover"
        >
          <Download size={14} /> {t("downloadAdminContactReport")}
        </a>
      </div>

      <div className="border-2 border-pn-ink p-4">
        <div className="mb-1 text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("validatedPerMonth")}</div>
        <p className="mb-4 text-xs text-pn-gray-2">{t("validatedPerMonthHint")}</p>
        <div className="flex gap-2">
          <div className="flex h-40 flex-col justify-between text-right text-[10px] text-pn-gray-3 tabular-nums">
            <span>{maxCount}</span>
            <span>0</span>
          </div>
          <div className="flex h-40 flex-1 items-end gap-1.5 border-b-2 border-l-2 border-pn-ink px-1.5">
            {perMonth.map((m) => (
              <div key={m.month} className="group relative flex h-full flex-1 flex-col justify-end" title={`${monthLabel(m.month)}: ${m.count}`}>
                <span className="mb-0.5 text-center text-[10px] font-semibold text-pn-gray-1 tabular-nums opacity-0 group-hover:opacity-100">
                  {m.count}
                </span>
                <div
                  className="w-full rounded-t-[3px] bg-pn-accent group-hover:bg-pn-accent-hover"
                  style={{ height: m.count === 0 ? 0 : `${Math.max((m.count / maxCount) * 100, 2)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="ml-[calc(0.5rem+1.5rem)] flex gap-1.5 px-1.5 pt-1.5">
          {perMonth.map((m) => (
            <div key={m.month} className="flex-1 text-center text-[10px] text-pn-gray-3">
              {monthLabel(m.month)}
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>{t("validatedPerMonth")}</caption>
          <thead>
            <tr>
              <th>{t("colMonth")}</th>
              <th>{t("colValidated")}</th>
            </tr>
          </thead>
          <tbody>
            {perMonth.map((m) => (
              <tr key={m.month}>
                <td>{monthLabel(m.month)}</td>
                <td>{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
