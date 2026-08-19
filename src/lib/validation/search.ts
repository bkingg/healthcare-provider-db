import { z } from "zod";
import { ProviderNameKind, ProviderStatus } from "@/lib/enums";
import { optionalString } from "./common";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** The status filter starts on Active: with no `statuses` in the URL, only
 * ACTIVE providers are searched. A present-but-empty `statuses=` means "any
 * status" — the filter bar writes that when the last status pill is switched
 * off (see toggleParamHref). */
export const DEFAULT_STATUSES: readonly string[] = ["ACTIVE"];

export function isDefaultStatuses(statuses: readonly string[]): boolean {
  return statuses.length === DEFAULT_STATUSES.length && statuses.every((s) => DEFAULT_STATUSES.includes(s));
}

export const SORT_COLUMNS = ["name", "type", "country", "status", "rating"] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];

function optionalNumber(min: number, max: number) {
  return z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= min && v <= max), `Must be between ${min} and ${max}`);
}

const uuidArray = z
  .array(z.string())
  .transform((vs) => vs.filter((v) => z.uuid().safeParse(v).success));

const statusArray = z.array(z.string()).transform((vs) => vs.filter((v): v is ProviderStatus => v in ProviderStatus));
const nameKindArray = z.array(z.string()).transform((vs) => vs.filter((v): v is ProviderNameKind => v in ProviderNameKind));

/** "Search this map area" — a `minLat,minLng,maxLat,maxLng` viewport, set
 * from the map's `getBounds()`. Distinct from the lat/lng/radiusKm circle
 * filter above; the map UI keeps the two mutually exclusive (picking one
 * clears the other's params), but the schema/query layer treat them as two
 * independent, ANDable spatial conditions. */
const bboxTuple = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const bbox = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.split(",").map(Number) : undefined))
  .pipe(bboxTuple.optional())
  .refine(
    (v) => v === undefined || (v[0] >= -90 && v[2] <= 90 && v[0] < v[2] && v[1] >= -180 && v[3] <= 180 && v[1] < v[3]),
    "Invalid bounding box",
  );

export const searchFiltersSchema = z.object({
  q: optionalString,
  countryIds: uuidArray,
  regionIds: uuidArray,
  city: optionalString,
  providerTypeIds: uuidArray,
  specialtyIds: uuidArray,
  capabilityIds: uuidArray,
  networkIds: uuidArray,
  statuses: statusArray,
  nameKinds: nameKindArray,
  lat: optionalNumber(-90, 90),
  lng: optionalNumber(-180, 180),
  radiusKm: optionalNumber(0.1, 20000),
  // Purely a display label for the resolved address/venue behind lat/lng —
  // round-trips through the URL so reloading or sharing a filtered link
  // shows the picked place name instead of bare coordinates. Never used in
  // the actual distance matching, which only reads lat/lng/radiusKm.
  pointLabel: optionalString,
  bbox,
  // Filters to providers with at least one UNCONFIRMED/DEFAULT-status
  // address — the map/list surface this as "Needs location review".
  needsLocationReview: z
    .string()
    .trim()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  // Provider.isOpen24_7 / Provider.erOpen24_7 — plain boolean columns, not
  // Capability rows (see provider.prisma's comment on those fields: a 24/7
  // schedule is a facility-wide attribute, not "what services it offers").
  isOpen24_7: z
    .string()
    .trim()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  erOpen24_7: z
    .string()
    .trim()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  sort: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.enum(SORT_COLUMNS).optional()),
  dir: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "desc" ? "desc" : "asc"))
    .pipe(z.enum(["asc", "desc"])),
  pageSize: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : DEFAULT_PAGE_SIZE))
    .refine((v): v is (typeof PAGE_SIZE_OPTIONS)[number] => (PAGE_SIZE_OPTIONS as readonly number[]).includes(v), "Invalid page size"),
  // Keyset pagination, not OFFSET: `cursors` is a `|`-joined stack of opaque
  // per-page boundary tokens (each one base64 JSON of {v, id} — see
  // encodeCursor/decodeCursor in src/data/search.ts). The *last* token is
  // "fetch rows after this boundary" for the current page; everything before
  // it is only kept so a Previous click can drop the last token and replay a
  // shallower query — Postgres never has to scan-and-discard N rows the way
  // OFFSET does, so page depth doesn't change per-page query cost. Reset to
  // "" whenever a filter, sort, or page size changes (old cursors encode a
  // position in a *different* ordering and are meaningless otherwise).
  cursors: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split("|").filter(Boolean) : [])),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

const FALLBACK: Record<string, string> = { dir: "asc", pageSize: String(DEFAULT_PAGE_SIZE) };

/** Next's `searchParams` values can be `string | string[] | undefined`.
 * Multi-select filters (country/type/status/specialty/capability/network)
 * keep every repeated value — `?providerTypeIds=X&providerTypeIds=Y` — to
 * back the design's toggle-pill filter groups; everything else takes the
 * first value. Falls back to page 1 / no filters on anything unparseable
 * rather than 500ing on a malformed URL. */
export function parseSearchParams(searchParams: Record<string, string | string[] | undefined>): SearchFilters {
  const asArray = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const asScalar = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const normalized = {
    q: asScalar(searchParams.q),
    city: asScalar(searchParams.city),
    lat: asScalar(searchParams.lat),
    lng: asScalar(searchParams.lng),
    radiusKm: asScalar(searchParams.radiusKm),
    pointLabel: asScalar(searchParams.pointLabel),
    bbox: asScalar(searchParams.bbox),
    needsLocationReview: asScalar(searchParams.needsLocationReview),
    isOpen24_7: asScalar(searchParams.isOpen24_7),
    erOpen24_7: asScalar(searchParams.erOpen24_7),
    sort: asScalar(searchParams.sort),
    dir: asScalar(searchParams.dir),
    pageSize: asScalar(searchParams.pageSize),
    cursors: asScalar(searchParams.cursors),
    countryIds: asArray(searchParams.countryIds),
    regionIds: asArray(searchParams.regionIds),
    providerTypeIds: asArray(searchParams.providerTypeIds),
    specialtyIds: asArray(searchParams.specialtyIds),
    capabilityIds: asArray(searchParams.capabilityIds),
    networkIds: asArray(searchParams.networkIds),
    statuses: searchParams.statuses === undefined ? [...DEFAULT_STATUSES] : asArray(searchParams.statuses).filter(Boolean),
    nameKinds: asArray(searchParams.nameKinds),
  };
  const parsed = searchFiltersSchema.safeParse(normalized);
  return parsed.success
    ? parsed.data
    : searchFiltersSchema.parse({
        countryIds: [],
        regionIds: [],
        providerTypeIds: [],
        specialtyIds: [],
        capabilityIds: [],
        networkIds: [],
        statuses: [...DEFAULT_STATUSES],
        nameKinds: [],
        ...FALLBACK,
      });
}
