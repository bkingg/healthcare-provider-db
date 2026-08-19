import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { type SearchFilters, type SortColumn } from "@/lib/validation/search";

function uuidIn(values: string[]) {
  return Prisma.join(
    values.map((v) => Prisma.sql`${v}::uuid`),
    ", ",
  );
}

/** SQL twin of formatProviderNumber() — the NMD-000123 code, matched by
 * substring so "NMD-0001", "000123" or just "123" all find it. Backed by
 * provider_number_code_trgm_idx in enable-search.sql. */
const PROVIDER_CODE_SQL = Prisma.sql`('NMD-' || lpad(p.provider_number::text, 6, '0'))`;

/** Word-boundary full-text search (tsvector/to_tsquery) can only match whole
 * words or prefixes — "teur" would never match "Pasteur". The search box
 * needs infix substring matching anywhere in the string, so this uses
 * trigram-indexed ILIKE instead (`provider_name_full_name_trgm_idx` /
 * `provider_external_id_trgm_idx` / `provider_id_text_trgm_idx` in
 * enable-search.sql — Postgres's planner uses the GIN trigram index to
 * accelerate `ILIKE '%token%'` on both sides, so this stays sublinear
 * instead of a sequential scan as the table grows). Splits on whitespace and
 * ANDs tokens together (each token independently matched against name
 * variants, external_id, OR the provider's own id — cast to text so the
 * "PROVIDERID" column shown throughout the UI, `id.slice(0, 8).toUpperCase()`
 * per results-table.tsx, is actually findable by pasting or typing it back
 * in) for progressive narrow-as-you-type search across multiple words. */
function toSearchTokens(q: string): string[] {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Output-column names from the `matched` CTE below — used both in ORDER BY
 * and in the keyset boundary condition, which (unlike ORDER BY) can't see
 * plain SELECT-list aliases without wrapping the query, hence the CTE. */
const SORT_COLUMN_ALIAS: Record<SortColumn, Prisma.Sql> = {
  name: Prisma.sql`primary_name`,
  type: Prisma.sql`type_name`,
  country: Prisma.sql`country_name`,
  status: Prisma.sql`status_text`,
  rating: Prisma.sql`rating_value`,
};

type CursorValue = string | number | null;
interface Cursor {
  v: CursorValue;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(token: string): Cursor | null {
  try {
    const obj: unknown = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (typeof obj !== "object" || obj === null || !("id" in obj) || typeof obj.id !== "string") return null;
    const v = "v" in obj ? obj.v : undefined;
    if (v !== null && typeof v !== "string" && typeof v !== "number") return null;
    return { v: v ?? null, id: obj.id };
  } catch {
    return null;
  }
}

/** `sortValueExpr > cursor.v` (flipped to `<` for DESC), with `id` as a
 * tiebreak for equal sort values and NULLS LAST handled explicitly (plain
 * row-comparison syntax doesn't handle NULL the way NULLS LAST does). A
 * cursor with `v: null` means the boundary row was itself in the NULLS-LAST
 * tail, so only later null-valued rows (by id) remain. */
function cursorCondition(sortValueExpr: Prisma.Sql, dir: "asc" | "desc", cursor: Cursor | null): Prisma.Sql {
  if (!cursor) return Prisma.sql`TRUE`;
  const cmp = Prisma.raw(dir === "desc" ? "<" : ">");
  if (cursor.v === null) {
    return Prisma.sql`(${sortValueExpr} IS NULL AND id ${cmp} ${cursor.id}::uuid)`;
  }
  return Prisma.sql`(
    ${sortValueExpr} ${cmp} ${cursor.v}
    OR (${sortValueExpr} = ${cursor.v} AND id ${cmp} ${cursor.id}::uuid)
    OR ${sortValueExpr} IS NULL
  )`;
}

/** Everything computed from `filters.lat/lng/radiusKm` — the "circle to
 * find" spatial filter, whether set from the sidebar's DistanceFilter or the
 * map's own draw-a-circle tool (both just set these three URL params). */
function resolveGeoFilter(filters: SearchFilters) {
  return filters.lat !== undefined && filters.lng !== undefined && filters.radiusKm !== undefined
    ? { lat: filters.lat, lng: filters.lng, radiusKm: filters.radiusKm }
    : undefined;
}

/**
 * Shared filter set (name+alias, country, city, provider type, specialty,
 * capability, network, status, name kind, needs-location-review, and the two
 * spatial filters — radius/"circle to find" and bounding-box/"search this
 * area") — one builder so `searchProviders` (the paginated `/providers`
 * table) and `searchProvidersForMap` (the map, which fetches every match up
 * to a cap rather than paging) can never drift apart on what counts as a
 * match. Every *filter* against a to-many relation is an `EXISTS (...)`
 * subquery rather than a JOIN, so a provider with several
 * addresses/specialties/etc. still contributes exactly one row — no
 * DISTINCT/GROUP BY needed.
 *
 * Country/type/status/specialty/capability/network are all multi-select
 * (`IN (...)`) to back the design's toggle-pill filter groups — a provider
 * matches if it has *any* of the selected values in a given category, and
 * categories AND together.
 */
function buildProviderWhereClause(filters: SearchFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  const searchTokens = filters.q ? toSearchTokens(filters.q) : [];
  if (searchTokens.length) {
    const tokenConditions = searchTokens.map((token) => {
      const pattern = `%${token}%`;
      return Prisma.sql`(
        EXISTS (SELECT 1 FROM provider_name pn WHERE pn.provider_id = p.id AND pn.full_name_text ILIKE ${pattern})
        OR p.external_id ILIKE ${pattern}
        OR p.id::text ILIKE ${pattern}
        OR ${PROVIDER_CODE_SQL} ILIKE ${pattern}
      )`;
    });
    conditions.push(Prisma.sql`(${Prisma.join(tokenConditions, " AND ")})`);
  }
  if (filters.countryIds.length) {
    conditions.push(Prisma.sql`p.country_id IN (${uuidIn(filters.countryIds)})`);
  }
  if (filters.regionIds.length) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM country_ref c WHERE c.id = p.country_id AND c.region_id IN (${uuidIn(filters.regionIds)}))`,
    );
  }
  if (filters.city) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM address a WHERE a.provider_id = p.id AND a.city ILIKE ${`%${filters.city}%`})`,
    );
  }
  if (filters.providerTypeIds.length) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM provider_provider_type ppt WHERE ppt.provider_id = p.id AND ppt.provider_type_id IN (${uuidIn(filters.providerTypeIds)}))`,
    );
  }
  if (filters.statuses.length) {
    conditions.push(
      Prisma.sql`p.status IN (${Prisma.join(
        filters.statuses.map((s) => Prisma.sql`${s}::"ProviderStatus"`),
        ", ",
      )})`,
    );
  }
  if (filters.nameKinds.length) {
    conditions.push(
      Prisma.sql`p.name_kind IN (${Prisma.join(
        filters.nameKinds.map((k) => Prisma.sql`${k}::"ProviderNameKind"`),
        ", ",
      )})`,
    );
  }
  if (filters.specialtyIds.length) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM provider_specialty ps WHERE ps.provider_id = p.id AND ps.specialty_id IN (${uuidIn(filters.specialtyIds)}))`,
    );
  }
  if (filters.capabilityIds.length) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM provider_capability pc WHERE pc.provider_id = p.id AND pc.capability_id IN (${uuidIn(filters.capabilityIds)}))`,
    );
  }
  if (filters.networkIds.length) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM network_contract nc WHERE nc.provider_id = p.id AND nc.network_id IN (${uuidIn(filters.networkIds)}))`,
    );
  }
  if (filters.needsLocationReview) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM address a WHERE a.provider_id = p.id AND a.coordinate_status IN ('UNCONFIRMED', 'DEFAULT'))`,
    );
  }
  if (filters.isOpen24_7) {
    conditions.push(Prisma.sql`p.is_open_24_7 = TRUE`);
  }
  if (filters.erOpen24_7) {
    conditions.push(Prisma.sql`p.er_open_24_7 = TRUE`);
  }

  const geo = resolveGeoFilter(filters);
  if (geo) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM address a
        WHERE a.provider_id = p.id AND a.location IS NOT NULL
        AND ST_DWithin(a.location, ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)::geography, ${geo.radiusKm * 1000})
      )`,
    );
  }
  // "Search this map area" — a rectangular viewport, not a circle; the UI
  // keeps these two spatial filters mutually exclusive (setting one clears
  // the other's params), but nothing here depends on that — both are just
  // ordinary ANDed conditions if somehow both were present.
  if (filters.bbox) {
    const [minLat, minLng, maxLat, maxLng] = filters.bbox;
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM address a
        WHERE a.provider_id = p.id AND a.location IS NOT NULL
        AND ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography && a.location
      )`,
    );
  }

  return conditions.length > 0 ? Prisma.join(conditions, " AND ") : Prisma.sql`TRUE`;
}

/**
 * Two-step fetch: a raw query resolves *which* providers match, in what
 * order; a normal typed `prisma.provider.findMany` then fetches display data
 * for exactly those ids, re-sorted in JS to preserve the raw query's order.
 * Keeps the row-matching/ranking logic in one carefully-reviewed place while
 * everything else stays on Prisma's typed query builder.
 *
 * Pagination is keyset (cursor), not OFFSET: OFFSET N makes Postgres generate
 * and discard N rows before it can return anything, so cost grows with page
 * depth no matter how well-indexed the query is. Keyset pagination instead
 * filters directly to "rows after the last one you saw" — see
 * cursorCondition — so each page costs the same regardless of how deep you
 * are. See `cursors` in src/lib/validation/search.ts for the URL-level
 * contract (a stack of opaque boundary tokens, one per page navigated).
 *
 * `cap` is the caller's role-based ceiling on total results (see
 * `maxSearchResults` in rbac.ts) — null means unlimited. It's enforced here,
 * not just hidden in the UI: once a page's starting offset would fall at or
 * past the cap, the query is skipped entirely and an empty page is returned,
 * so a capped actor can't reach further rows by hand-crafting cursor tokens.
 * `total`/`totalPages` are likewise clamped to the cap so a capped actor
 * never learns the true size of the full directory.
 */
export async function searchProviders(filters: SearchFilters, cap: number | null = null) {
  const whereClause = buildProviderWhereClause(filters);
  const searchTokens = filters.q ? toSearchTokens(filters.q) : [];
  const geo = resolveGeoFilter(filters);

  const rankSelect = filters.q
    ? Prisma.sql`GREATEST(
        (SELECT MAX(similarity(pn.full_name_text, ${filters.q})) FROM provider_name pn WHERE pn.provider_id = p.id),
        COALESCE(similarity(p.external_id, ${filters.q}), 0),
        similarity(p.id::text, ${filters.q}),
        similarity(${PROVIDER_CODE_SQL}, ${filters.q})
      )`
    : Prisma.sql`NULL`;

  const distanceSelect = geo
    ? Prisma.sql`(SELECT MIN(ST_Distance(a.location, ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)::geography)) FROM address a WHERE a.provider_id = p.id AND a.location IS NOT NULL)`
    : Prisma.sql`NULL`;

  const sortValueExpr = filters.sort
    ? SORT_COLUMN_ALIAS[filters.sort]
    : searchTokens.length
      ? Prisma.sql`rank`
      : geo
        ? Prisma.sql`distance_m`
        : Prisma.sql`primary_name`;
  // Text search / geo distance default to their natural best-first direction
  // (rank DESC, distance ASC) regardless of `dir` — there's no explicit sort
  // column selected to carry an ASC/DESC toggle in that case, matching the
  // pre-keyset behavior this replaces.
  const effectiveDir: "asc" | "desc" = filters.sort ? filters.dir : searchTokens.length ? "desc" : "asc";
  const effectiveDirSql = Prisma.raw(effectiveDir === "desc" ? "DESC" : "ASC");

  const pageSize = filters.pageSize;
  const cursorToken = filters.cursors[filters.cursors.length - 1];
  const cursor = cursorToken ? decodeCursor(cursorToken) : null;
  const boundary = cursorCondition(sortValueExpr, effectiveDir, cursor);

  const page = filters.cursors.length + 1;
  const offset = (page - 1) * pageSize;
  // If this page starts at or past the cap, it's entirely out of bounds —
  // skip the query rather than let the LIMIT clamp to 0 and still round-trip.
  const remainingBudget = cap === null ? null : Math.max(0, cap - offset);
  const effectivePageSize = remainingBudget === null ? pageSize : Math.min(pageSize, remainingBudget);

  const [rows, countRows] = await Promise.all([
    effectivePageSize === 0
      ? Promise.resolve([])
      : prisma.$queryRaw<
          { id: string; cursor_value: string | number | null; primary_name: string | null; type_name: string | null; country_name: string | null; rating_value: string | number | null }[]
        >`
      WITH matched AS (
        SELECT p.id,
          ${rankSelect} AS rank,
          ${distanceSelect} AS distance_m,
          (SELECT pn.full_name_text FROM provider_name pn WHERE pn.provider_id = p.id ORDER BY pn.is_primary DESC LIMIT 1) AS primary_name,
          -- Provider type is to-many now (like name), not a plain FK, so this
          -- picks the primary type the same way primary_name does — no
          -- longer a LEFT JOIN, since a provider can have 0..N types.
          -- English name only — this is a sort key (SORT_COLUMN_ALIAS.type),
          -- not display text (the results grid's Type column is built from
          -- the localized Prisma include below, not this raw column).
          (SELECT pt.name_en FROM provider_provider_type ppt JOIN provider_type_ref pt ON pt.id = ppt.provider_type_id
            WHERE ppt.provider_id = p.id ORDER BY ppt.is_primary DESC LIMIT 1) AS type_name,
          c.name AS country_name,
          -- Quality + Access stars added together (null when unrated); see lib/providerRating.ts.
          NULLIF(COALESCE(p.quality_rating, 0) + COALESCE(p.access_rating, 0), 0) AS rating_value,
          p.status::text AS status_text
        FROM provider p
        LEFT JOIN country_ref c ON c.id = p.country_id
        WHERE ${whereClause}
      )
      SELECT id, ${sortValueExpr} AS cursor_value, primary_name, type_name, country_name, rating_value
      FROM matched
      WHERE ${boundary}
      ORDER BY ${sortValueExpr} ${effectiveDirSql} NULLS LAST, id ${effectiveDirSql}
      LIMIT ${effectivePageSize}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM provider p
      WHERE ${whereClause}
    `,
  ]);

  const rawTotal = Number(countRows[0]?.count ?? 0);
  const total = cap === null ? rawTotal : Math.min(rawTotal, cap);
  const ids = rows.map((r) => r.id);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNextPage = page < totalPages;
  const lastRow = rows[rows.length - 1];
  const nextCursorToken = hasNextPage && lastRow ? encodeCursor({ v: lastRow.cursor_value, id: lastRow.id }) : null;

  const today = new Date();
  const providers = ids.length
    ? await prisma.provider.findMany({
        where: { id: { in: ids } },
        include: {
          providerTypes: { include: { providerType: true }, orderBy: { isPrimary: "desc" } },
          country: true,
          names: { where: { isPrimary: true }, take: 1 },
          addresses: { where: { isPrimary: true }, take: 1 },
          specialties: { include: { specialty: true } },
          // Grid shows every network currently in effect, not just one —
          // "currently" meaning today falls within [effectiveDate, endDate]
          // (an open-ended contract has no endDate at all).
          networkContracts: {
            where: { effectiveDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
            include: { network: true },
          },
          // Grid's "Facility" column (results-table.tsx): which provider(s)
          // this one is affiliated with — e.g. a physician's hospital, or a
          // hospital's consulting physicians. Affiliation has no enforced
          // subject/related direction (see affiliations-section.tsx's own
          // merge of both), so both sides are fetched and joined the same way.
          affiliationsAsSubject: { include: { relatedProvider: { include: { names: { where: { isPrimary: true }, take: 1 } } } } },
          affiliationsAsRelated: { include: { provider: { include: { names: { where: { isPrimary: true }, take: 1 } } } } },
        },
      })
    : [];

  const providersById = new Map(providers.map((p) => [p.id, p]));
  const orderedProviders = ids.map((id) => providersById.get(id)).filter((p) => p !== undefined);

  return {
    providers: orderedProviders,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage: filters.cursors.length > 0,
    nextCursorToken,
    capped: cap !== null && rawTotal > cap,
    cap,
  };
}

/** Bounded by default, like every other unbounded-by-nature listing in this
 * app — a map clustering tens of thousands of markers is a performance
 * problem long before it's a useful map, so this caps at MAP_RESULT_LIMIT
 * and reports `truncated` so the UI can prompt "narrow your search" rather
 * than silently dropping rows. */
const MAP_RESULT_LIMIT = 500;

/**
 * Unlike `searchProviders`, the map needs its *entire* matched set at once
 * (up to the cap) to cluster and plot correctly, and the results list next
 * to it must show every match — mapped or not — so this isn't paginated and
 * doesn't filter out providers lacking coordinates; the caller decides how
 * to render an address-less row (see MapSearchView).
 *
 * `cap` (see `maxSearchResults` in rbac.ts, null = unlimited) is enforced
 * the same way as in `searchProviders` — it tightens the raw-query LIMIT
 * itself, not just what's displayed, so the map can't be used to bypass the
 * limit applied to the paginated provider search.
 */
export async function searchProvidersForMap(filters: SearchFilters, cap: number | null = null) {
  const whereClause = buildProviderWhereClause(filters);
  const effectiveLimit = cap === null ? MAP_RESULT_LIMIT : Math.min(MAP_RESULT_LIMIT, cap);

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM provider p WHERE ${whereClause} ORDER BY p.id LIMIT ${effectiveLimit}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM provider p WHERE ${whereClause}`,
  ]);

  const rawTotal = Number(countRows[0]?.count ?? 0);
  const total = cap === null ? rawTotal : Math.min(rawTotal, cap);
  const ids = rows.map((r) => r.id);

  const providers = ids.length
    ? await prisma.provider.findMany({
        where: { id: { in: ids } },
        include: {
          providerTypes: { include: { providerType: true }, orderBy: { isPrimary: "desc" } },
          country: true,
          names: { where: { isPrimary: true }, take: 1 },
          addresses: { where: { isPrimary: true }, take: 1 },
        },
      })
    : [];

  // The SQL ORDER BY above is just p.id (cheap, index-only) so the LIMIT
  // doesn't have to evaluate a correlated name subquery over every match
  // before cutting the set down — sort the (already-capped) final list by
  // name here instead, for a stable, readable display order.
  providers.sort((a, b) => (a.names[0]?.fullNameText ?? "").localeCompare(b.names[0]?.fullNameText ?? ""));

  return { providers, total, truncated: rawTotal > effectiveLimit, limit: effectiveLimit };
}
