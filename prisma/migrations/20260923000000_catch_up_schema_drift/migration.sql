-- Catch-up migration: schema changes that were committed to prisma/schema
-- without a migration (provider name kind, notes and 24/7 flags, multiple
-- provider types per provider, individual titles, the address.updated_by
-- foreign key). Without it a database built from migrations doesn't match
-- the schema and the seed fails. Written to be safe on an existing database
-- as well as a fresh one: data is carried over before anything is dropped.

-- CreateEnum
CREATE TYPE "ProviderNameKind" AS ENUM ('ENTITY', 'INDIVIDUAL');

-- CreateTable
CREATE TABLE "provider_provider_type" (
    "provider_id" UUID NOT NULL,
    "provider_type_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_provider_type_pkey" PRIMARY KEY ("provider_id","provider_type_id")
);

-- CreateTable
CREATE TABLE "provider_title_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_title_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_title_ref_code_key" ON "provider_title_ref"("code");

-- Data: each provider's single type (provider.provider_type_id) becomes its
-- primary row in provider_provider_type before that column is dropped.
INSERT INTO "provider_provider_type" ("provider_id", "provider_type_id", "is_primary")
SELECT "id", "provider_type_id", true
FROM "provider"
WHERE "provider_type_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "provider" DROP CONSTRAINT "provider_provider_type_id_fkey";

-- DropIndex
DROP INDEX "provider_provider_type_id_idx";

-- AlterTable
ALTER TABLE "provider" DROP COLUMN "provider_type_id",
ADD COLUMN     "er_open_24_7" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "external_notes" TEXT,
ADD COLUMN     "internal_notes" TEXT,
ADD COLUMN     "is_open_24_7" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name_kind" "ProviderNameKind" NOT NULL DEFAULT 'ENTITY';

-- The init migration created provider_name.search_vector as a plain,
-- always-NULL column, which made prisma/sql/enable-search.sql's
-- `ADD COLUMN IF NOT EXISTS` skip creating the real generated column, so
-- full-text search returned nothing on databases built from migrations.
-- Drop it only when it's that plain column: a database where the search
-- script already created the generated column keeps it. Run
-- `npm run db:search-setup` after migrating, as before.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'provider_name'::regclass
      AND attname = 'search_vector'
      AND NOT attisdropped
      AND attgenerated = ''
  ) THEN
    ALTER TABLE "provider_name" DROP COLUMN "search_vector";
  END IF;
END $$;

-- AlterTable
ALTER TABLE "provider_name" ADD COLUMN     "individual_title_id" UUID;

-- Data: clear updated_by values that point at users who no longer exist,
-- so the new foreign key below can be added.
UPDATE "address" SET "updated_by" = NULL
WHERE "updated_by" IS NOT NULL
  AND "updated_by" NOT IN (SELECT "id" FROM "app_user");

-- AddForeignKey
ALTER TABLE "provider_name" ADD CONSTRAINT "provider_name_individual_title_id_fkey" FOREIGN KEY ("individual_title_id") REFERENCES "provider_title_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_provider_type" ADD CONSTRAINT "provider_provider_type_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_provider_type" ADD CONSTRAINT "provider_provider_type_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "provider_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
