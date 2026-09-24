"use client";

import { useState } from "react";
import { formatProviderNumber } from "@/lib/providerNumber";
import { formatProviderRating } from "@/lib/providerRating";
import { useLocale, useTranslations } from "next-intl";
import { localizedText } from "@/lib/localizedText";
import { useRouter, Link } from "@/i18n/navigation";
import { PnTag } from "@/components/pn-tag";
import { ResizeHandle } from "@/components/resize-handle";
import { usePanelWidths } from "@/lib/panel-widths";
import type { searchProviders } from "@/data/search";
import type { SortColumn } from "@/lib/validation/search";
import { PROVIDER_COLUMNS, buildGridTemplate, useVisibleColumns, type ProviderColumnKey } from "./column-visibility";

type ProviderRow = Awaited<ReturnType<typeof searchProviders>>["providers"][number];
type RawParams = Record<string, string | string[] | undefined>;

// Which columns' headers sort the results, and by which sort key.
const COLUMN_SORT: Partial<Record<ProviderColumnKey, SortColumn>> = {
  name: "name",
  type: "type",
  countryCity: "country",
  status: "status",
  rating: "rating",
};

const COLUMN_LABEL_KEY = Object.fromEntries(PROVIDER_COLUMNS.map((c) => [c.key, c.labelKey])) as Record<
  ProviderColumnKey,
  (typeof PROVIDER_COLUMNS)[number]["labelKey"]
>;

/** A header cell with a drag handle on its right edge (see ResizeHandle).
 * `min-w-0` lets a column be dragged narrower than its label — the label
 * just clips, same as the body cells' ellipsis. */
function ResizableHeader({ colKey, label, children }: { colKey: string; label: string; children: React.ReactNode }) {
  const t = useTranslations("Search");
  return (
    <div className="relative flex h-full min-w-0 items-center overflow-visible pr-2">
      <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{children}</div>
      <ResizeHandle panelKey={`col:${colKey}`} measure="parent" label={t("resizeColumn", { column: label })} />
    </div>
  );
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
  const { orderedVisibleColumns } = useVisibleColumns();
  const { widths } = usePanelWidths();
  const { template: cols, minWidth } = buildGridTemplate(orderedVisibleColumns, widths);
  // Rating's number is right-aligned against the table's edge when it's the
  // last column; anywhere else that would butt it up against its neighbour.
  const alignRatingRight = orderedVisibleColumns.at(-1) === "rating";

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
        <div style={{ minWidth }}>
          <div
            className="sticky top-0 z-[2] grid h-[30px] items-center gap-0 border-b-2 border-pn-ink bg-pn-panel px-5 text-[10px] font-bold tracking-[0.07em] text-pn-gray-1 uppercase"
            style={{ gridTemplateColumns: cols }}
          >
            <div>
              <div className="h-[11px] w-[11px] border-2 border-pn-ink" />
            </div>
            {orderedVisibleColumns.map((key) => {
              const label = t(COLUMN_LABEL_KEY[key]);
              const sortCol = COLUMN_SORT[key];
              return (
                <ResizableHeader key={key} colKey={key} label={label}>
                  {sortCol ? (
                    <SortableHeader
                      label={label}
                      col={sortCol}
                      rawParams={rawParams}
                      currentSort={sort}
                      currentDir={dir}
                      className={key === "rating" && alignRatingRight ? "justify-end" : undefined}
                    />
                  ) : (
                    label
                  )}
                </ResizableHeader>
              );
            })}
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
                {orderedVisibleColumns.map((key) => {
                  switch (key) {
                    case "providerId":
                      return <div key={key} className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-2 tabular-nums">{shortId}</div>;
                    case "name":
                      return (
                        <div key={key} className="min-w-0">
                          <div className="overflow-hidden font-semibold text-ellipsis whitespace-nowrap">{primaryName}</div>
                          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-pn-gray-3">{p.externalId ?? ""}</div>
                        </div>
                      );
                    case "type":
                      return <div key={key} className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-1" title={typeNames}>{typeNames}</div>;
                    case "countryCity":
                      return (
                        <div key={key} className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-1">
                          {p.country.name}
                          {p.addresses?.[0]?.city ? ` · ${p.addresses[0].city}` : ""}
                        </div>
                      );
                    case "specialties":
                      return <div key={key} className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-2">{specs}</div>;
                    case "facility":
                      return <div key={key} className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-1" title={affiliatedWith}>{affiliatedWith}</div>;
                    case "network":
                      return <div key={key} className="overflow-hidden text-ellipsis whitespace-nowrap text-pn-gray-1" title={networks}>{networks}</div>;
                    case "status":
                      return (
                        <div key={key} className="min-w-0 overflow-hidden">
                          <PnTag status={p.status} />
                        </div>
                      );
                    case "rating":
                      return (
                        <div key={key} className={`overflow-hidden font-semibold whitespace-nowrap tabular-nums ${alignRatingRight ? "text-right" : ""}`}>
                          {formatProviderRating(p.qualityRating, p.accessRating) ?? "—"}
                        </div>
                      );
                  }
                })}
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
