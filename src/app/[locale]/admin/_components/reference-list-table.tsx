"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { healthSystemRatingClasses } from "@/lib/healthSystemRating";
import { setReferenceItemActiveAction } from "../actions";
import { SortHeader } from "./sort-header";
import { EditItemDialog } from "./item-dialogs";
import { ManageRegionCountriesDialog } from "./manage-region-countries-dialog";
import { useExtraColumns } from "./reference-column-visibility";
import type { FieldDef, ReferenceListDef, ReferenceListKey } from "@/lib/referenceListDefs";
import { MAP_ICON_COMPONENTS } from "@/components/map-marker-pin";
import { isHexColor, isMapIconKey } from "@/lib/mapMarkerStyle";

type RefOptions = Partial<Record<ReferenceListKey, { id: string; label: string }[]>>;
type ClientItem = Record<string, unknown> & { id: string; isActive: boolean; updatedAt: Date };

/** Renders one value list item's field, following the same `kind`-to-markup
 * mapping as ReferenceItemFields in item-dialogs.tsx, but read-only and
 * dense enough for a table cell (long text truncates with the full value in
 * a tooltip; a refSelect's stored id is resolved to its label the same way
 * the edit form's RefSelect would show it selected). */
function ExtraColumnCell({ field, item, refOptions }: { field: FieldDef; item: ClientItem; refOptions: RefOptions }) {
  const raw = item[field.key];
  if (raw === null || raw === undefined || raw === "") return <span className="text-pn-gray-3">—</span>;

  switch (field.kind) {
    case "checkbox":
      return <Checkbox checked={Boolean(raw)} disabled />;
    case "select":
      return <>{String(raw).replaceAll("_", " ")}</>;
    case "refSelect": {
      const label = refOptions[field.refListKey]?.find((o) => o.id === raw)?.label;
      return label ? <>{label}</> : <span className="text-pn-gray-3">—</span>;
    }
    case "mapIcon": {
      if (!isMapIconKey(raw)) return <>{String(raw)}</>;
      const Icon = MAP_ICON_COMPONENTS[raw];
      return <Icon size={16} aria-label={raw} />;
    }
    case "color":
      return isHexColor(raw) ? (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span className="inline-block h-3.5 w-3.5 border border-pn-rule" style={{ background: raw }} />
          {raw}
        </span>
      ) : (
        <>{String(raw)}</>
      );
    case "textarea":
      return (
        <span className="block max-w-[260px] truncate" title={String(raw)}>
          {String(raw)}
        </span>
      );
    case "number":
    case "text":
    default:
      return <>{String(raw)}</>;
  }
}

export function ReferenceListTable({
  listKey,
  def,
  items,
  refOptions,
  canEditThisList,
  countriesForRegions,
  regionNameById,
  ratingScaleById,
  extraFields,
  requestedSort,
  sortDir,
}: {
  listKey: ReferenceListKey;
  def: ReferenceListDef;
  items: ClientItem[];
  refOptions: RefOptions;
  canEditThisList: boolean;
  countriesForRegions: { id: string; name: string; iso2: string; regionId: string | null }[];
  regionNameById: Map<string, string>;
  ratingScaleById: Map<string, { label: string; value: number | null }>;
  /** Every field the Columns chooser offers for this list — the table only
   * renders the ones currently toggled on (see useExtraColumns). */
  extraFields: FieldDef[];
  requestedSort: string | undefined;
  sortDir: "asc" | "desc";
}) {
  const t = useTranslations("Admin");
  const { visibleColumns } = useExtraColumns(listKey);
  const shownExtraFields = extraFields.filter((f) => visibleColumns.has(f.key));
  const primaryLabelHeaderKey = def.fields.find((f) => f.key === def.primaryLabelField)?.labelKey ?? def.primaryLabelField;
  const colSpan = 3 + shownExtraFields.length + (listKey === "countries" ? 2 : 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader label={t(`fields.${def.codeField.labelKey}`)} col="code" listKey={listKey} currentSort={requestedSort} currentDir={sortDir} />
          <SortHeader label={t(`fields.${primaryLabelHeaderKey}`)} col="name" listKey={listKey} currentSort={requestedSort} currentDir={sortDir} />
          {listKey === "countries" && (
            <>
              <SortHeader label={t("fields.region")} col="region" listKey={listKey} currentSort={requestedSort} currentDir={sortDir} />
              <SortHeader label={t("fields.qualityRating")} col="rating" listKey={listKey} currentSort={requestedSort} currentDir={sortDir} />
            </>
          )}
          {shownExtraFields.map((field) => (
            <TableHead key={field.key}>{t(`fields.${field.labelKey}`)}</TableHead>
          ))}
          <SortHeader label={t("colStatus")} col="status" listKey={listKey} currentSort={requestedSort} currentDir={sortDir} />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{String(item[def.codeField.key])}</TableCell>
            <TableCell>{String(item[def.primaryLabelField])}</TableCell>
            {listKey === "countries" && (
              <TableCell>
                {(item.regionId ? regionNameById.get(item.regionId as string) : undefined) ?? <span className="text-pn-gray-3">—</span>}
              </TableCell>
            )}
            {listKey === "countries" && (
              <TableCell>
                {(() => {
                  const rating = item.qualityRatingId ? ratingScaleById.get(item.qualityRatingId as string) : undefined;
                  if (!rating) return <span className="text-pn-gray-3">{t("notRated")}</span>;
                  return (
                    <span className={`border-2 px-[7px] py-px text-[11px] font-semibold ${healthSystemRatingClasses(rating.value)}`}>
                      {rating.value === null ? rating.label : `${rating.label} (${rating.value})`}
                    </span>
                  );
                })()}
              </TableCell>
            )}
            {shownExtraFields.map((field) => (
              <TableCell key={field.key}>
                <ExtraColumnCell field={field} item={item} refOptions={refOptions} />
              </TableCell>
            ))}
            <TableCell>
              <Badge variant={item.isActive ? "default" : "outline"}>{item.isActive ? t("active") : t("inactive")}</Badge>
            </TableCell>
            <TableCell>
              {canEditThisList ? (
                <div className="flex items-center gap-2">
                  {listKey === "regions" && <ManageRegionCountriesDialog region={{ id: item.id, name: item.name as string }} countries={countriesForRegions} />}
                  <EditItemDialog listKey={listKey} def={def} refOptions={refOptions} item={item} />
                  {!def.editOnly && (
                    <form action={setReferenceItemActiveAction}>
                      <input type="hidden" name="listKey" value={listKey} />
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="isActive" value={String(!item.isActive)} />
                      <Button type="submit" variant="ghost" size="sm">
                        {item.isActive ? t("deactivate") : t("activate")}
                      </Button>
                    </form>
                  )}
                </div>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
              {t("noItems")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
