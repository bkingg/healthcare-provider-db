-- Short human-facing provider ID (NMD-000123). Existing providers are
-- numbered oldest-first; new ones draw from the sequence. Written by hand
-- (not a plain SERIAL) so the backfill follows created_at rather than
-- physical row order.
CREATE SEQUENCE "provider_provider_number_seq";

ALTER TABLE "provider" ADD COLUMN "provider_number" INTEGER;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS n FROM "provider"
)
UPDATE "provider" SET "provider_number" = numbered.n
FROM numbered WHERE "provider"."id" = numbered."id";

SELECT setval('"provider_provider_number_seq"', COALESCE((SELECT MAX("provider_number") FROM "provider"), 0) + 1, false);

ALTER TABLE "provider" ALTER COLUMN "provider_number" SET DEFAULT nextval('"provider_provider_number_seq"');
ALTER TABLE "provider" ALTER COLUMN "provider_number" SET NOT NULL;
ALTER SEQUENCE "provider_provider_number_seq" OWNED BY "provider"."provider_number";

CREATE UNIQUE INDEX "provider_provider_number_key" ON "provider"("provider_number");
