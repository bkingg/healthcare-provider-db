-- Medication delivery, step 4: the member's price and approval, payments
-- (member → Nomad, Nomad → pharmacy), and Nomad's payment links.

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('FROM_MEMBER', 'TO_PHARMACY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WAVE', 'ORANGE_MONEY', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REPORTED', 'CONFIRMED', 'REJECTED');

-- AlterEnum

ALTER TYPE "CaseEventType" ADD VALUE 'PRICE_SENT';
ALTER TYPE "CaseEventType" ADD VALUE 'PRICE_APPROVED';
ALTER TYPE "CaseEventType" ADD VALUE 'PRICE_DECLINED';
ALTER TYPE "CaseEventType" ADD VALUE 'PAYMENT_REPORTED';
ALTER TYPE "CaseEventType" ADD VALUE 'PAYMENT_CONFIRMED';
ALTER TYPE "CaseEventType" ADD VALUE 'PHARMACY_PAID';

-- AlterEnum
ALTER TYPE "StaffNotificationKind" ADD VALUE 'ORDER_UPDATE';

-- AlterTable
ALTER TABLE "medication_order" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_staff_id" UUID,
ADD COLUMN     "decline_reason" TEXT,
ADD COLUMN     "declined_at" TIMESTAMP(3),
ADD COLUMN     "delivery_xof" INTEGER,
ADD COLUMN     "fee_xof" INTEGER,
ADD COLUMN     "medicines_xof" INTEGER,
ADD COLUMN     "payment_link_url" TEXT,
ADD COLUMN     "price_note" TEXT,
ADD COLUMN     "price_sent_at" TIMESTAMP(3),
ADD COLUMN     "price_valid_until" TIMESTAMP(3),
ADD COLUMN     "total_xof" INTEGER;

-- CreateTable
CREATE TABLE "medication_order_payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount_xof" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "reference" TEXT,
    "external_id" TEXT,
    "provider_id" UUID,
    "banking_payment_id" UUID,
    "reported_by_member" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_order_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_link_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_link_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medication_order_payment_order_id_idx" ON "medication_order_payment"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_link_ref_code_key" ON "payment_link_ref"("code");

-- AddForeignKey
ALTER TABLE "medication_order_payment" ADD CONSTRAINT "medication_order_payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "medication_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_payment" ADD CONSTRAINT "medication_order_payment_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_payment" ADD CONSTRAINT "medication_order_payment_banking_payment_id_fkey" FOREIGN KEY ("banking_payment_id") REFERENCES "banking_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_payment" ADD CONSTRAINT "medication_order_payment_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fee and price settings (Admin > Value lists > Medication delivery settings).
INSERT INTO "medication_delivery_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES
  ('NOMAD_FEE_BASE_XOF', 'Nomad fee: fixed part (FCFA)', 'Frais Nomad : part fixe (FCFA)', 1000, 100, CURRENT_TIMESTAMP),
  ('NOMAD_FEE_PERCENT', 'Nomad fee: % of medicines', 'Frais Nomad : % des médicaments', 5, 110, CURRENT_TIMESTAMP),
  ('NIGHT_SURCHARGE_XOF', 'Night surcharge (FCFA)', 'Majoration de nuit (FCFA)', 1000, 120, CURRENT_TIMESTAMP),
  ('NIGHT_START_HOUR', 'Night starts at (hour, Dakar)', 'Début de la nuit (heure, Dakar)', 22, 130, CURRENT_TIMESTAMP),
  ('NIGHT_END_HOUR', 'Night ends at (hour, Dakar)', 'Fin de la nuit (heure, Dakar)', 7, 140, CURRENT_TIMESTAMP),
  ('PRICE_ROUND_XOF', 'Round delivery and fee up to (FCFA)', 'Arrondir livraison et frais à (FCFA)', 100, 150, CURRENT_TIMESTAMP),
  ('PRICE_VALID_MINUTES', 'Price valid for the member (minutes)', 'Validité du prix pour le membre (minutes)', 60, 160, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Placeholders, OFF until Nomad's real links are entered (Admin > Value
-- lists > Medication delivery > Payment links).
INSERT INTO "payment_link_ref" ("code", "method", "label_en", "label_fr", "url", "sort_order", "is_active", "updated_at") VALUES
  ('WAVE', 'WAVE', 'Pay with Wave', 'Payer avec Wave', 'https://pay.wave.com/m/REPLACE_WITH_NOMAD_MERCHANT_LINK', 10, false, CURRENT_TIMESTAMP),
  ('ORANGE_MONEY', 'ORANGE_MONEY', 'Pay with Orange Money', 'Payer avec Orange Money', 'https://REPLACE_WITH_NOMAD_ORANGE_MONEY_LINK', 20, false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
