"use client";

import { startTransition, useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Upload } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { memberImportAction, type MemberImportState } from "./actions";

export function MemberImportForm() {
  const t = useTranslations("MemberImport");
  const [file, setFile] = useState<File | null>(null);
  const [state, dispatch, pending] = useActionState<MemberImportState | null, FormData>(memberImportAction, null);
  const [showAll, setShowAll] = useState(false);

  // The chosen file is kept in state and sent explicitly: React resets a
  // form's file input after an action runs, which would otherwise empty it
  // between "Check file" and "Import".
  function run(intent: "check" | "import") {
    if (!file) return;
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("file", file);
    startTransition(() => dispatch(fd));
  }

  if (state?.stage === "done") {
    return (
      <div className="flex flex-col gap-3 border-2 border-pn-ink bg-white p-4">
        <div className="flex items-center gap-2 text-[14px] font-bold">
          <CheckCircle2 size={18} className="text-pn-accent" /> {t("doneTitle", { created: state.created })}
        </div>
        <p className="m-0 text-[12.5px] text-pn-gray-2">
          {t("doneDetail", { households: state.households, file: state.fileName })}
          {state.skipped > 0 && ` ${t("doneSkipped", { skipped: state.skipped })}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/members" className="flex h-8 items-center border-none bg-pn-accent px-3 text-xs font-semibold text-white hover:bg-pn-accent-hover">
            {t("viewMembers")}
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="h-8 cursor-pointer border-2 border-pn-ink px-3 text-xs font-semibold hover:bg-pn-surface-hover">
            {t("importAnother")}
          </button>
        </div>
      </div>
    );
  }

  const preview = state?.stage === "preview" ? state : null;
  const rowsToShow = preview ? (showAll ? preview.rows : preview.rows.filter((r) => r.errors.length > 0)) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("fileLabel")}
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-[12.5px] tracking-normal text-pn-ink normal-case file:mr-3 file:h-8 file:cursor-pointer file:border-2 file:border-pn-ink file:bg-transparent file:px-3 file:text-xs file:font-semibold"
          />
        </label>
        <button
          type="button"
          disabled={!file || pending}
          onClick={() => run("check")}
          className="flex h-8 cursor-pointer items-center gap-[7px] border-2 border-pn-ink bg-pn-ink px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Upload size={13} /> {pending ? t("working") : t("checkFile")}
        </button>
      </div>

      {state?.stage === "error" && (
        <div role="alert" className="border-l-4 border-[#dc2626] bg-white p-3 text-[12.5px]">
          <div className="mb-1 font-bold">{t("fileProblem")}</div>
          <ul className="m-0 pl-4">
            {state.fileErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="font-semibold">{preview.fileName}</span>
            <span className="bg-pn-ink px-2 py-px text-[11px] font-bold text-white">{t("readyCount", { count: preview.summary.ready })}</span>
            {preview.summary.withErrors > 0 && (
              <span className="bg-[#dc2626] px-2 py-px text-[11px] font-bold text-white">{t("errorCount", { count: preview.summary.withErrors })}</span>
            )}
            <span className="text-pn-gray-2">{t("householdCount", { count: preview.summary.households })}</span>
          </div>

          {preview.summary.ready > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => run("import")}
                className="h-8 cursor-pointer border-none bg-pn-accent px-3 text-xs font-semibold text-white hover:bg-pn-accent-hover disabled:opacity-40"
              >
                {pending ? t("working") : t("importButton", { count: preview.summary.ready })}
              </button>
              {preview.summary.withErrors > 0 && <span className="text-[12px] text-pn-gray-2">{t("errorsSkipped")}</span>}
            </div>
          ) : (
            <p className="m-0 text-[12.5px] text-pn-gray-2">{t("nothingReady")}</p>
          )}

          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-[11px] font-bold tracking-[0.08em] text-pn-gray-1 uppercase">
              {showAll ? t("allRows") : t("rowsWithErrors")}
            </h3>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="cursor-pointer text-[11.5px] font-semibold text-[#0a5c3c]">
              {showAll ? t("showErrorsOnly") : t("showAllRows")}
            </button>
          </div>
          <div className="overflow-x-auto border border-pn-rule bg-white">
            <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-pn-ink bg-pn-panel text-left text-[10px] font-bold tracking-[0.07em] text-pn-gray-1 uppercase">
                  <th className="px-3 py-2">{t("colRow")}</th>
                  <th className="px-3 py-2">{t("colName")}</th>
                  <th className="px-3 py-2">{t("colHousehold")}</th>
                  <th className="px-3 py-2">{t("colRole")}</th>
                  <th className="px-3 py-2">{t("colResult")}</th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.map((r) => (
                  <tr key={r.rowNumber} className="border-b border-pn-rule align-top">
                    <td className="px-3 py-2 tabular-nums text-pn-gray-2">{r.rowNumber}</td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2 text-pn-gray-1">{r.householdId}</td>
                    <td className="px-3 py-2 text-pn-gray-1">{r.role === "PRIMARY" ? t("rolePrimary") : r.role}</td>
                    <td className="px-3 py-2">
                      {r.errors.length === 0 ? (
                        <span className="font-semibold text-[#0a5c3c]">{t("ready")}</span>
                      ) : (
                        <ul className="m-0 pl-4 text-[#b91c1c]">
                          {r.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
                {rowsToShow.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-pn-gray-3">
                      {t("noErrors")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
