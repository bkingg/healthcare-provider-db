-- Medication delivery, step 3: asking pharmacies (quotes on a private
-- link), the medication price history for analysis, and settings.

-- CreateEnum
CREATE TYPE "PharmacyQuoteStatus" AS ENUM ('PREPARED', 'SENT', 'ANSWERED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteAvailability" AS ENUM ('AVAILABLE', 'PARTIAL', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "PriceTimeBand" AS ENUM ('DAY', 'EVENING', 'NIGHT');

-- AlterEnum

ALTER TYPE "CaseEventType" ADD VALUE 'QUOTE_SENT';
ALTER TYPE "CaseEventType" ADD VALUE 'QUOTE_ANSWERED';
ALTER TYPE "CaseEventType" ADD VALUE 'QUOTE_CHOSEN';
ALTER TYPE "CaseEventType" ADD VALUE 'ORDER_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "medication_order" ADD COLUMN     "chosen_quote_id" UUID;

-- CreateTable
CREATE TABLE "pharmacy_quote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "status" "PharmacyQuoteStatus" NOT NULL DEFAULT 'PREPARED',
    "rank" INTEGER NOT NULL,
    "distance_km" DOUBLE PRECISION,
    "open_when_asked" BOOLEAN NOT NULL,
    "token_hash" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_by_id" UUID,
    "expires_at" TIMESTAMP(3),
    "answered_at" TIMESTAMP(3),
    "preparation_minutes" INTEGER,
    "can_dispense_narcotic" BOOLEAN,
    "can_pack_cold_chain" BOOLEAN,
    "pharmacist_name" TEXT,
    "note" TEXT,
    "entered_by_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_quote_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "availability" "QuoteAvailability" NOT NULL,
    "quantity_offered" INTEGER,
    "pack_price_xof" INTEGER,
    "pack_description" TEXT,
    "units_per_pack" INTEGER,
    "substitution" TEXT,

    CONSTRAINT "pharmacy_quote_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_price_observation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "observed_at" TIMESTAMP(3) NOT NULL,
    "medication_id" UUID,
    "item_label" TEXT NOT NULL,
    "pack_description" TEXT,
    "units_per_pack" INTEGER,
    "price_per_pack_xof" INTEGER NOT NULL,
    "price_per_unit_xof" DOUBLE PRECISION,
    "provider_id" UUID NOT NULL,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "day_of_week" INTEGER NOT NULL,
    "time_band" "PriceTimeBand" NOT NULL,
    "pharmacy_open_24_7" BOOLEAN NOT NULL,
    "availability" "QuoteAvailability" NOT NULL,
    "is_substitution" BOOLEAN NOT NULL,
    "response_minutes" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'QUOTE',
    "is_outlier" BOOLEAN NOT NULL DEFAULT false,
    "quote_line_id" UUID,
    "quote_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_price_observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_delivery_setting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "value" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_delivery_setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_quote_token_hash_key" ON "pharmacy_quote"("token_hash");

-- CreateIndex
CREATE INDEX "pharmacy_quote_provider_id_sent_at_idx" ON "pharmacy_quote"("provider_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_quote_order_id_provider_id_key" ON "pharmacy_quote"("order_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_quote_line_quote_id_order_line_id_key" ON "pharmacy_quote_line"("quote_id", "order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "medication_price_observation_quote_line_id_key" ON "medication_price_observation"("quote_line_id");

-- CreateIndex
CREATE INDEX "medication_price_observation_medication_id_observed_at_idx" ON "medication_price_observation"("medication_id", "observed_at");

-- CreateIndex
CREATE INDEX "medication_price_observation_provider_id_observed_at_idx" ON "medication_price_observation"("provider_id", "observed_at");

-- CreateIndex
CREATE UNIQUE INDEX "medication_delivery_setting_code_key" ON "medication_delivery_setting"("code");

-- CreateIndex
CREATE UNIQUE INDEX "medication_order_chosen_quote_id_key" ON "medication_order"("chosen_quote_id");

-- AddForeignKey
ALTER TABLE "medication_order" ADD CONSTRAINT "medication_order_chosen_quote_id_fkey" FOREIGN KEY ("chosen_quote_id") REFERENCES "pharmacy_quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_quote" ADD CONSTRAINT "pharmacy_quote_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "medication_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_quote" ADD CONSTRAINT "pharmacy_quote_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_quote" ADD CONSTRAINT "pharmacy_quote_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_quote_line" ADD CONSTRAINT "pharmacy_quote_line_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "pharmacy_quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_quote_line" ADD CONSTRAINT "pharmacy_quote_line_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "medication_order_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_price_observation" ADD CONSTRAINT "medication_price_observation_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_price_observation" ADD CONSTRAINT "medication_price_observation_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_price_observation" ADD CONSTRAINT "medication_price_observation_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "pharmacy_quote_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starting settings (Admin > Value lists > Medication delivery).
INSERT INTO "medication_delivery_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES
  ('QUOTE_LINK_MINUTES', 'Quote link valid for (minutes)', 'Validité du lien de devis (minutes)', 120, 10, CURRENT_TIMESTAMP),
  ('PHARMACIES_TO_ASK', 'Pharmacies to ask first', 'Pharmacies à interroger d''abord', 3, 20, CURRENT_TIMESTAMP),
  ('QUOTE_WAIT_MINUTES', 'Wait for answers (minutes)', 'Attente des réponses (minutes)', 15, 30, CURRENT_TIMESTAMP),
  ('QUOTE_WAIT_URGENT_MINUTES', 'Wait for answers, urgent (minutes)', 'Attente des réponses, urgent (minutes)', 10, 40, CURRENT_TIMESTAMP),
  ('URGENT_PRICE_MARGIN_PERCENT', 'Urgent: pay up to this much more for the fastest (%)', 'Urgent : surcoût accepté pour le plus rapide (%)', 15, 50, CURRENT_TIMESTAMP),
  ('DELIVERY_BASE_XOF', 'Delivery estimate: base (FCFA)', 'Estimation livraison : base (FCFA)', 1000, 60, CURRENT_TIMESTAMP),
  ('DELIVERY_PER_KM_XOF', 'Delivery estimate: per km (FCFA)', 'Estimation livraison : par km (FCFA)', 200, 70, CURRENT_TIMESTAMP),
  ('COURIER_MINUTES_PER_KM', 'Courier travel: minutes per km', 'Trajet coursier : minutes par km', 3, 80, CURRENT_TIMESTAMP),
  ('PRICE_OUTLIER_FACTOR', 'Flag prices this many times off the usual', 'Signaler les prix écartés de ce facteur', 3, 90, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
