-- CreateTable
CREATE TABLE "medication_timeframe_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "help_en" TEXT,
    "help_fr" TEXT,
    "is_offered" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_timeframe_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medication_timeframe_ref_code_key" ON "medication_timeframe_ref"("code");


-- The four choices as the order form showed them until now.
INSERT INTO "medication_timeframe_ref" ("code", "label_en", "label_fr", "help_en", "help_fr", "sort_order", "updated_at") VALUES
  ('WITHIN_HOUR', 'Urgent (less than 1 hour)', 'Urgent (moins d''1 heure)', 'Not for life-threatening emergencies — call the emergency numbers at the top of the screen or go to the nearest emergency room.', 'Pas pour une urgence vitale — appelez les numéros d''urgence en haut de l''écran ou rendez-vous aux urgences les plus proches.', 1, CURRENT_TIMESTAMP),
  ('TODAY', 'Today', 'Aujourd’hui', NULL, NULL, 2, CURRENT_TIMESTAMP),
  ('THIS_WEEK', 'This week', 'Cette semaine', NULL, NULL, 3, CURRENT_TIMESTAMP),
  ('ROUTINE', 'No rush', 'Pas urgent', NULL, NULL, 4, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
