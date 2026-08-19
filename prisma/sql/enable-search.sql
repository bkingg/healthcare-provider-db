-- Search + data-quality infrastructure (Phases 3-4): generated columns and
-- extensions Prisma Migrate can't express (see Unsupported("tsvector") /
-- Unsupported("geography(Point,4326)") in prisma/schema/provider.prisma, and
-- the Phase 3/4 plans for why this is a standalone script rather than a
-- Prisma migration).
--
-- Idempotent — safe to re-run. Run after `prisma migrate dev` has created the
-- base tables:
--   npm run db:search-setup

-- postgis is normally already enabled by Prisma Migrate (datasource `extensions
-- = [postgis]` in schema.prisma), but guard it here too so this script has no
-- hidden dependency on that having run first.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Full-text search over every name variant (legal/display/billing/local/alias)
-- so "name + alias matching" falls out of a single generated column per row,
-- no separate alias-matching logic needed.
ALTER TABLE provider_name
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', full_name_text)) STORED;

CREATE INDEX IF NOT EXISTS provider_name_search_vector_idx
  ON provider_name USING GIN (search_vector);

-- Radius/distance search. NULL when latitude/longitude aren't set yet
-- (coordinate_status = MISSING/DEFAULT/UNCONFIRMED) rather than a default
-- (0,0) point, so an unconfirmed address never matches a radius filter.
ALTER TABLE address
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS address_location_idx
  ON address USING GIST (location);

-- Phase 4 duplicate-candidate detection: fuzzy name matching via trigram
-- similarity (src/lib/import/validateRow.ts), alongside the exact-match
-- check on provider.external_id which needs no extra infrastructure.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS provider_name_full_name_trgm_idx
  ON provider_name USING GIN (full_name_text gin_trgm_ops);

-- Provider search box (src/data/search.ts): substring matching anywhere in
-- the string ("teur" must match "Pasteur"), not just whole-word/prefix, so
-- name search reuses this same trigram index rather than the tsvector one
-- above (word-boundary FTS can't do infix matches). external_id already has
-- a btree index from @unique, which can't accelerate `ILIKE '%...%'` either.
CREATE INDEX IF NOT EXISTS provider_external_id_trgm_idx
  ON provider USING GIN (external_id gin_trgm_ops);

-- Same as above, for matching the provider's own id — the "PROVIDERID"
-- column shown throughout the UI is `id.slice(0, 8).toUpperCase()`
-- (results-table.tsx), so the search box needs to find a provider by that
-- short id (or the full uuid) the same way it finds one by name.
CREATE INDEX IF NOT EXISTS provider_id_text_trgm_idx
  ON provider USING GIN ((id::text) gin_trgm_ops);

-- The NMD-000123 provider code (lib/providerNumber.ts), searchable by
-- substring like the uuid above. The expression must match PROVIDER_CODE_SQL
-- in data/search.ts exactly for the planner to use this index.
CREATE INDEX IF NOT EXISTS provider_number_code_trgm_idx
  ON provider USING GIN (('NMD-' || lpad(provider_number::text, 6, '0')) gin_trgm_ops);
