-- Split the display name of the four admin-managed taxonomy lists (provider
-- types, specialties, languages, capabilities) into English and French
-- columns, admin-maintained (no auto-translation) — same treatment as
-- 20260922010000_split_tooltips_en_fr. Existing English content is preserved
-- as-is; the new French columns start empty for an admin to fill in from
-- Admin > Value lists.

-- provider_type_ref
ALTER TABLE "provider_type_ref" RENAME COLUMN "name" TO "name_en";
ALTER TABLE "provider_type_ref" ADD COLUMN "name_fr" TEXT;

-- specialty
ALTER TABLE "specialty" RENAME COLUMN "name" TO "name_en";
ALTER TABLE "specialty" ADD COLUMN "name_fr" TEXT;

-- language
ALTER TABLE "language" RENAME COLUMN "name" TO "name_en";
ALTER TABLE "language" ADD COLUMN "name_fr" TEXT;

-- capability
ALTER TABLE "capability" RENAME COLUMN "name" TO "name_en";
ALTER TABLE "capability" ADD COLUMN "name_fr" TEXT;
