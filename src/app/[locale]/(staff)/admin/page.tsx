import { getTranslations } from "next-intl/server";
import { getCurrentActor } from "@/lib/actor";
import { canEditValueLists, canManageUsers } from "@/lib/rbac";
import { listReferenceItems, listReferenceOptions } from "@/data/adminReferenceLists";
import { REFERENCE_LIST_DEFS, REFERENCE_LIST_KEYS, isRefSelectField, type ReferenceListDef, type ReferenceListKey } from "@/lib/referenceListDefs";
import { ListNav } from "./_components/list-nav";
import { AddItemDialog } from "./_components/item-dialogs";
import { ColumnChooser } from "./_components/column-chooser";
import { ReferenceListTable } from "./_components/reference-list-table";

/** Prisma Decimals (e.g. a rating scale's numericValue) can't be passed to a
 * client component — hand the edit dialog plain numbers instead. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClientItem<T extends Record<string, any>>(item: T): T {
  return Object.fromEntries(
    Object.entries(item).map(([k, v]) => [k, v && typeof v === "object" && !(v instanceof Date) && typeof v.toFixed === "function" ? Number(v) : v]),
  ) as T;
}

function isListKey(v: string | undefined): v is ReferenceListKey {
  return !!v && v in REFERENCE_LIST_DEFS;
}

export default async function AdminPage(props: PageProps<"/[locale]/admin">) {
  const t = await getTranslations("Admin");
  const actor = await getCurrentActor();
  const canEditLists = canEditValueLists(actor);
  const canManageAccess = canManageUsers(actor);
  if (!canEditLists && !canManageAccess) throw new Error("Not authorized to view value lists");

  const rawSearchParams = await props.searchParams;
  const requested = typeof rawSearchParams.list === "string" ? rawSearchParams.list : undefined;
  const listKey: ReferenceListKey = isListKey(requested) ? requested : REFERENCE_LIST_KEYS[0];
  const canEditThisList = listKey === "userRoles" ? canManageAccess : canEditLists;
  // Widened to the general ReferenceListDef shape — REFERENCE_LIST_DEFS
  // itself keeps each list's literal-narrowed type (see the `satisfies`
  // comment there), but the generic admin UI below only needs the common shape.
  const def: ReferenceListDef = REFERENCE_LIST_DEFS[listKey];

  // Fields the Columns chooser offers as extra table columns — every form
  // field except the one already shown as the row's main label, and (for
  // Countries) region/rating, which are already always-shown hardcoded
  // columns below rather than optional ones.
  const extraFields = def.fields.filter(
    (f) => f.key !== def.primaryLabelField && !(listKey === "countries" && (f.key === "regionId" || f.key === "qualityRatingId")),
  );

  const refSelectFields = def.fields.filter(isRefSelectField);
  const refListKeys = Array.from(new Set(refSelectFields.map((f) => f.refListKey)));
  // Regions need every country (id/name/iso2/regionId) too, to power the
  // "Manage countries" dialog below — countries' own regionId is how that
  // membership is actually stored (see setRegionCountries).
  const [items, countriesForRegions, ratingScales, regionItems, ...optionResults] = await Promise.all([
    listReferenceItems(listKey),
    listKey === "regions" ? listReferenceItems("countries") : Promise.resolve([]),
    // The Countries table shows each country's healthcare-system rating.
    listKey === "countries" ? listReferenceItems("ratingScales") : Promise.resolve([]),
    // ...and its Region.
    listKey === "countries" ? listReferenceItems("regions") : Promise.resolve([]),
    ...refListKeys.map((k) => listReferenceOptions(k)),
  ]);
  const refOptions: Partial<Record<ReferenceListKey, { id: string; label: string }[]>> = {};
  refListKeys.forEach((k, i) => {
    refOptions[k] = optionResults[i];
  });

  const ratingScaleById = new Map(
    ratingScales.map((r) => [r.id as string, { label: r.label as string, value: r.numericValue === null ? null : Number(r.numericValue) }]),
  );

  const regionNameById = new Map(regionItems.map((r) => [r.id as string, r.name as string]));

  // Sortable columns: the ones the table below shows. `null` sorts last in
  // either direction.
  const sortValues: Record<string, (item: (typeof items)[number]) => string | number | null> = {
    code: (item) => String(item[def.codeField.key]),
    name: (item) => String(item[def.primaryLabelField]),
    region: (item) => (item.regionId ? (regionNameById.get(item.regionId) ?? null) : null),
    rating: (item) => (item.qualityRatingId ? (ratingScaleById.get(item.qualityRatingId)?.value ?? null) : null),
    status: (item) => (item.isActive ? 0 : 1),
  };
  const requestedSort = typeof rawSearchParams.sort === "string" && rawSearchParams.sort in sortValues ? rawSearchParams.sort : undefined;
  const sortDir: "asc" | "desc" = rawSearchParams.dir === "desc" ? "desc" : "asc";
  const sortedItems = requestedSort
    ? [...items].sort((a, b) => {
        const av = sortValues[requestedSort](a);
        const bv = sortValues[requestedSort](b);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : items;

  const clientItems = sortedItems.map(toClientItem);
  const clientCountriesForRegions = countriesForRegions.map(toClientItem);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <ListNav selectedKey={listKey} />

      <div className="flex min-w-0 flex-1 flex-col overflow-auto p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t(`lists.${listKey}`)}</h1>
            <p className="mt-[5px] text-xs text-pn-gray-2">{t("itemCount", { count: items.length })}</p>
          </div>
          <div className="flex items-center gap-2">
            {extraFields.length > 0 && <ColumnChooser listKey={listKey} fields={extraFields} />}
            {canEditThisList && !def.editOnly && <AddItemDialog listKey={listKey} def={def} refOptions={refOptions} />}
          </div>
        </div>

        <ReferenceListTable
          listKey={listKey}
          def={def}
          items={clientItems}
          refOptions={refOptions}
          canEditThisList={canEditThisList}
          countriesForRegions={clientCountriesForRegions}
          regionNameById={regionNameById}
          ratingScaleById={ratingScaleById}
          extraFields={extraFields}
          requestedSort={requestedSort}
          sortDir={sortDir}
        />
      </div>
    </div>
  );
}
