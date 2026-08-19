-- Split tooltip/hover text into English and French columns, admin-maintained
-- (no auto-translation). Existing English content is preserved as-is; the
-- new French columns start empty for an admin to fill in from Admin > Value
-- lists.

-- ui_hint_ref (UI element tooltips, e.g. "Validate record")
ALTER TABLE "ui_hint_ref" RENAME COLUMN "description" TO "description_en";
ALTER TABLE "ui_hint_ref" ADD COLUMN "description_fr" TEXT;

-- rating_scale_ref (healthcare system rating tooltip)
ALTER TABLE "rating_scale_ref" RENAME COLUMN "description" TO "description_en";
ALTER TABLE "rating_scale_ref" ADD COLUMN "description_fr" TEXT;

-- rating_criterion_ref (Quality / Access star-rating tooltips)
ALTER TABLE "rating_criterion_ref" RENAME COLUMN "description" TO "description_en";
ALTER TABLE "rating_criterion_ref" ADD COLUMN "description_fr" TEXT;
ALTER TABLE "rating_criterion_ref" RENAME COLUMN "level_1_meaning" TO "level_1_meaning_en";
ALTER TABLE "rating_criterion_ref" ADD COLUMN "level_1_meaning_fr" TEXT;
ALTER TABLE "rating_criterion_ref" RENAME COLUMN "level_2_meaning" TO "level_2_meaning_en";
ALTER TABLE "rating_criterion_ref" ADD COLUMN "level_2_meaning_fr" TEXT;
ALTER TABLE "rating_criterion_ref" RENAME COLUMN "level_3_meaning" TO "level_3_meaning_en";
ALTER TABLE "rating_criterion_ref" ADD COLUMN "level_3_meaning_fr" TEXT;
ALTER TABLE "rating_criterion_ref" RENAME COLUMN "level_4_meaning" TO "level_4_meaning_en";
ALTER TABLE "rating_criterion_ref" ADD COLUMN "level_4_meaning_fr" TEXT;
ALTER TABLE "rating_criterion_ref" RENAME COLUMN "level_5_meaning" TO "level_5_meaning_en";
ALTER TABLE "rating_criterion_ref" ADD COLUMN "level_5_meaning_fr" TEXT;
