import { getLocale, getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireEditValueLists } from "@/lib/rbac";
import { formatDakarDateTime } from "@/lib/formatDate";
import { formatCaseNumber } from "@/lib/caseNumber";
import { staffLabel } from "@/lib/handle";
import { aiModel } from "@/lib/ai";
import { copilotReport } from "@/data/copilot";

const usd = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

/** Admin > AI copilot: whether it's on, this month's spending against the
 * budget, how each button is used and what staff do with the answers (the
 * measure of whether it's worth it), and the latest uses. */
export default async function CopilotAdminPage() {
  const t = await getTranslations("CopilotAdmin");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireEditValueLists(actor);
  const r = await copilotReport();
  const barColor = r.budget.paused ? "bg-[#c62828]" : r.budget.warn ? "bg-[#d97706]" : "bg-pn-accent";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="m-0 flex items-center gap-2 text-[22px] font-extrabold tracking-[-0.02em]">
          <Sparkles size={20} className="text-[#5b21b6]" aria-hidden /> {t("title")}
        </h1>
        <p className="mt-[5px] max-w-[80ch] text-xs text-pn-gray-2">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 border-2 border-pn-ink p-4">
          <div className="text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("status")}</div>
          <div className="text-[15px] font-bold">{t(`provider.${r.provider}`)}</div>
          {r.provider === "openai" && <div className="text-[12px] text-pn-gray-2">{t("model", { model: aiModel() })}</div>}
          <p className="m-0 text-[12px] text-pn-gray-2">{t(`providerHint.${r.provider}`)}</p>
        </div>
        <div className="flex flex-col gap-1.5 border-2 border-pn-ink p-4">
          <div className="text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("thisMonth")}</div>
          <div className="text-[15px] font-bold tabular-nums">
            {t("spent", { spent: usd(r.budget.spentUsd), budget: usd(r.budget.budgetUsd), percent: r.budget.percent })}
          </div>
          <div className="h-2.5 w-full bg-pn-panel" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, r.budget.percent)} aria-label={t("thisMonth")}>
            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, r.budget.percent)}%` }} />
          </div>
          {r.budget.paused ? (
            <p className="m-0 text-[12px] font-semibold text-[#c62828]">{t("paused")}</p>
          ) : r.budget.warn ? (
            <p className="m-0 text-[12px] font-semibold text-[#b45309]">{t("warn", { percent: r.settings.WARN_AT_PERCENT })}</p>
          ) : null}
          <Link href="/admin?list=copilotSettings" className="text-[12px] font-semibold text-[#0a5c3c]">
            {t("editBudget")}
          </Link>
        </div>
      </div>

      <div className="border-2 border-pn-ink">
        <div className="flex items-center justify-between border-b-2 border-pn-ink px-4 py-2">
          <span className="text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("byButton")}</span>
          <Link href="/admin?list=copilotTasks" className="text-[12px] font-semibold text-[#0a5c3c]">
            {t("editButtons")}
          </Link>
        </div>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-pn-rule text-left text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
              <th className="px-4 py-2">{t("button")}</th>
              <th className="px-2 py-2 text-right">{t("uses")}</th>
              <th className="px-2 py-2">{t("whatStaffDid")}</th>
              <th className="px-2 py-2 text-right">{t("usedRate")}</th>
              <th className="px-4 py-2 text-right">{t("cost")}</th>
            </tr>
          </thead>
          <tbody>
            {r.byTask.map((b) => (
              <tr key={b.task} className="border-b border-pn-rule last:border-b-0">
                <td className="px-4 py-2 font-semibold">{t(`task.${b.task}`)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{b.total}</td>
                <td className="px-2 py-2 text-pn-gray-1">
                  {Object.entries(b.outcomes)
                    .filter(([, n]) => n > 0)
                    .map(([o, n]) => `${t(`outcome.${o}`)} ${n}`)
                    .join(" · ") || "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{b.usedPercent === null ? "—" : `${b.usedPercent}%`}</td>
                <td className="px-4 py-2 text-right tabular-nums">{usd(b.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 border-t border-pn-rule px-4 py-2 text-[11.5px] text-pn-gray-2">{t("usedRateHint")}</p>
      </div>

      {r.pendingFlags > 0 && (
        <Link href="/admin/medications/flags" className="self-start text-[13px] font-semibold text-[#5b21b6]">
          {t("pendingFlags", { count: r.pendingFlags })}
        </Link>
      )}

      <div className="border-2 border-pn-ink">
        <div className="border-b-2 border-pn-ink px-4 py-2 text-[10px] font-bold tracking-[0.09em] text-pn-gray-3 uppercase">{t("latest")}</div>
        {r.latest.length === 0 ? (
          <p className="m-0 px-4 py-3 text-[12.5px] text-pn-gray-2">{t("none")}</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-pn-rule text-left text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
                <th className="px-4 py-1.5">{t("when")}</th>
                <th className="px-2 py-1.5">{t("who")}</th>
                <th className="px-2 py-1.5">{t("button")}</th>
                <th className="px-2 py-1.5">{t("case")}</th>
                <th className="px-2 py-1.5">{t("result")}</th>
                <th className="px-2 py-1.5 text-right">{t("tokens")}</th>
                <th className="px-4 py-1.5 text-right">{t("cost")}</th>
              </tr>
            </thead>
            <tbody>
              {r.latest.map((u) => (
                <tr key={u.id} className="border-b border-pn-rule last:border-b-0">
                  <td className="px-4 py-1.5 whitespace-nowrap tabular-nums">{formatDakarDateTime(u.createdAt, locale)}</td>
                  <td className="px-2 py-1.5">{staffLabel(u.user)}</td>
                  <td className="px-2 py-1.5">{t(`task.${u.task}`)}</td>
                  <td className="px-2 py-1.5">{u.case ? <Link href={`/cases/${u.case.id}`}>{formatCaseNumber(u.case.caseNumber)}</Link> : "—"}</td>
                  <td className="px-2 py-1.5">
                    {t(`outcome.${u.outcome}`)}
                    {u.provider === "mock" && <span className="ml-1 text-[11px] text-[#b45309]">({t("test")})</span>}
                    {u.error && <span className="block text-[11px] text-pn-gray-2">{u.error}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {u.inputTokens + u.outputTokens}
                    {u.estimated && "*"}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{usd(u.costMicroUsd / 1_000_000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="m-0 border-t border-pn-rule px-4 py-2 text-[11.5px] text-pn-gray-2">{t("privacyNote")}</p>
      </div>
    </div>
  );
}
