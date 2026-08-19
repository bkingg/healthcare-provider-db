-- One-time transitional migration (not idempotent like enable-search.sql):
-- converts Provider.provider_type_id from a required scalar FK into a
-- to-many assignment table (provider_provider_type), mirroring
-- provider_specialty. Every existing provider's current type becomes its
-- primary type. Applied by hand via psql, NOT `prisma migrate dev` — this
-- database has out-of-band changes (search_vector/pg_trgm) that make
-- `migrate dev` want to run `migrate reset` and drop all data. See
-- AGENTS.md/session notes: schema changes are applied by hand here.
--
-- Run once:
--   psql -p 5432 -U provider_admin -d healthcare_provider_db \
--     -f prisma/sql/migrate-provider-type-many-to-many.sql

BEGIN;

CREATE TABLE provider_provider_type (
  provider_id      UUID NOT NULL REFERENCES provider(id) ON UPDATE CASCADE ON DELETE CASCADE,
  provider_type_id UUID NOT NULL REFERENCES provider_type_ref(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider_id, provider_type_id)
);

INSERT INTO provider_provider_type (provider_id, provider_type_id, is_primary, created_at)
SELECT id, provider_type_id, true, now() FROM provider;

ALTER TABLE provider DROP COLUMN provider_type_id;

COMMIT;
