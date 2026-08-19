"use client";

import { useState } from "react";
import { formatProviderNumber } from "@/lib/providerNumber";
import { formatProviderRating } from "@/lib/providerRating";
import { useLocale, useTranslations } from "next-intl";
import { localizedText } from "@/lib/localizedText";
import { useRouter, Link } from "@/i18n/navigation";
import { PnTag } from "@/components/pn-tag";
import type { searchProviders } from "@/data/search";
import type { SortColumn } from "@/lib/validation/search";
import { PROVIDER_COLUMNS, useVisibleColumns, type ProviderColumnKey } from "./column-visibility";

type ProviderRow = Awaited<ReturnType<typeof searchProviders>>["providers"][number];
type RawParams = Record<string, string | string[] | undefined>;

const CHECKBOX_COL = "28px";
const NAME_COL = "minmax(160px,1.6fr)";

// Checkbox and Name are always in the grid; the rest only appear when
// toggled on via the Columns menu (see column-visibility.ts). ProviderID is
// the only toggleable column before Name — everything else in
// PROVIDER_COLUMNS comes after, in declared order, so hiding/showing one
// never reorders the rest.
const [PROVIDER_ID_COL, ...TRAILING_COLS] = PROVIDER_COLUMNS;

function buildGridTemplate(visibleColumns: Set<ProviderColumnKey>): string {
  const cols = [CHECKBOX_COL];
  if (visibleColumns.has(PROVIDER_ID_COL.key)) cols.push(PROVIDER_ID_COL.width);
  cols.push(NAME_COL);
  for (const col of TRAILING_COLS) {
    if (visibleColumns.has(col.key)) cols.push(col.width);
  }
  return cols.join(" ");
}

function sortHref(rawParams: RawParams, col: SortColumn, currentSort: SortColumn | undefined, currentDir: "asc" | "desc") {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(rawParams)) {
    if (v === undefined || k === "sort" || k === "dir" || k === "cursors") continue;
    for (const single of Array.isArray(v) ? v : [v]) params.append(k, single);
  }
  params.set("sort", col);
  params.set("dir", currentSort === col && currentDir === "asc" ? "desc" : "asc");
  return `/providers?${params.toString()}`;
}

function SortableHeader({
  label,
  col,
  rawParams,
  currentSort,
  currentDir,
  className,
}: {
  label: string;
  col: SortColumn;
  rawParams: RawParams;
  currentSort: SortColumn | undefined;
  currentDir: "asc" | "desc";
  className?: string;
}) {
  const active = currentSort === col;
  return (
    <Link
      href={sortHref(rawParams, col, currentSort, currentDir)}
      className={`flex items-center gap-1 hover:text-pn-ink ${active ? "text-pn-ink" : ""} ${className ?? ""}`}
    >
      {label}
      <span className="text-[9px] leading-none">{active ? (currentDir === "asc" ? "▲" : "▼") : ""}</span>
    </Link>
  );
}

export function ResultsTable({
  providers,
  rawParams,
  sort,
  dir,
}: {
  providers: ProviderRow[];
  rawParams: RawParams;
  sort: SortColumn | undefined;
  dir: "asc" | "desc";
}) {
  const t = useTranslations("Search");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { visibleColumns } = useVisibleColumns();
  const cols = buildGridTemplate(visibleColumns);

  function toggle(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          <div
            className="sticky top-0 z-[2] grid h-[30px] items-center gap-0 border-b-2 border-pn-ink bg-pn-panel px-5 text-[10px] font-bold tracking-[0.07em] text-pn-gray-1 uppercase"
            style={{ gridTemplateColumns: cols }}
          >
            <div>
              <div className="h-[11px] w-[11px] border-2 border-pn-ink" />
            </div>
            {visibleColumns.has("providerId") && <div>{t("columnProviderId")}</div>}
            <SortableHeader label={t("columnName")} col="name" rawParams={rawParams} currentSort={sort} currentDir={dir} />
            {visibleColumns.has("type") && <SortableHeader label={t("columnType")} col="type" rawParams={rawParams} currentSort={sort} currentDir={dir} />}
            {visibleColumns.has("countryCity") && (
              <SortableHeader label={t("columnCountryCity")} col="country" rawParams={rawParams} currentSort={sort} currentDir={dir} />
            )}
            {visibleColumns.has("specialties") && <div>{t("columnSpecialties")}</div>}
            {visibleColumns.has("facility") && <div>{t("columnFacility")}</div>}
            {visibleColumns.has("network") && <div>{t("columnNetwork")}</div>}
            {visibleColumns.has("status") && (
              <SortableHeader label={t("columnStatus")} col="status" rawParams={rawParams} currentSort={sort} currentDir={dir} />
            )}
            {visibleColumns.has("rating") && (
              <SortableHeader label={t("columnRating")} col="rating" rawParams={rawParams} currentSort={sort} currentDir={dir} className="justify-end" />
            )}
          </div>

          {providers.map((p) => {
            const primaryName = p.names[0]?.fullNameText ?? t("unnamed");
            const shortId = formatProviderNumber(p.providerNumber);
            const checked = selected.has(p.id);
            const specs = p.specialties.map((s) => localizedText(s.specialty.nameEn, s.specialty.nameFr, locale)).join(", ") || "—";
            const typeNames = p.providerTypes.map((pt) => localizedText(pt.providerType.nameEn, pt.providerType.nameFr, locale)).join(", ") || "—";
            const networks = p.networkContracts.map((nc) => nc.network.name).join(", ") || "—";
            // Whichever side of the affiliation this provider is on — see
            // the include comment in search.ts — so a physician's hospital
            // and a hospital's consulting physicians both show up here.
            const affiliatedWith =
              [
                ...p.affiliationsAsSubject.map((a) => a.relatedProvider.names[0]?.fullNameText),
                ...p.affiliationsAsRelated.map((a) => a.provider.names[0]?.fullNameText),
              ]
                .filter(Boolean)
                .join(", ") || "—";
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/providers/${p.id}`)}
                className="grid cursor-pointer items-center gap-0 border-b border-pn-rule px-5 py-[7px] text-[12.5px] hover:bg-pn-surface-hover"
                style={{ gridTemplateColumns: cols }}
              >
                <div>
                  <div
                    onClick={(e) => toggle(p.id, e)}
                    className={`h-[11px] w-[11px] border-2 border-pn-ink ${checked ? "bg-pn-accent" : "bg-transparent"}`}
                  />
                </div>
                {visibleColumns.has("providerId") && <div className="text-pn-gray-2 tabular-nums">{shortId}</div>}
                <div className="min-w-0">
                  <div className="overflow-hidden font-semibold text-ellipsis whitespace-nowrap">{primaryName}</div>
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-pn-gray-3">{p.externalId ?? ""}</div>
                </div>
                {visibleColumns.has("type") && (
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-1" title={typeNames}>{typeNames}</div>
                )}
                {visibleColumns.has("countryCity") && (
                  <div className="text-pn-gray-1">
                    {p.country.name}
                    {p.addresses?.[0]?.city ? ` · ${p.addresses[0].city}` : ""}
                  </div>
                )}
                {visibleColumns.has("specialties") && <div className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-2">{specs}</div>}
                {visibleColumns.has("facility") && (
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-1" title={affiliatedWith}>{affiliatedWith}</div>
                )}
                {visibleColumns.has("network") && (
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-1" title={networks}>{networks}</div>
                )}
                {visibleColumns.has("status") && (
                  <div>
                    <PnTag status={p.status} />
                  </div>
                )}
                {visibleColumns.has("rating") && (
                  <div className="text-right font-semibold tabular-nums">{formatProviderRating(p.qualityRating, p.accessRating) ?? "—"}</div>
                )}
              </div>
            );
          })}

          {providers.length === 0 && <div className="p-8 text-center text-pn-gray-3">{t("noResults")}</div>}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-none items-center justify-between border-t-2 border-pn-ink bg-pn-panel px-5 py-2 text-[11.5px]">
          <span className="text-pn-gray-2">
            <strong className="text-pn-ink">{t("selected", { count: selected.size })}</strong> · {t("bulkActionsHint")}
          </span>
        </div>
      )}
    </div>
  );
}
