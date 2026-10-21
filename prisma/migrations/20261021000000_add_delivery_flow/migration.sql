-- CreateEnum
CREATE TYPE "OrderChargeStatus" AS ENUM ('DUE', 'PAID', 'WAIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CaseEventType" ADD VALUE 'PHARMACY_PAYMENT_CONFIRMED';
ALTER TYPE "CaseEventType" ADD VALUE 'COURIER_BOOKED';
ALTER TYPE "CaseEventType" ADD VALUE 'DELIVERY_FAILED';
ALTER TYPE "CaseEventType" ADD VALUE 'REDELIVERY_FEE_WAIVED';
ALTER TYPE "CaseEventType" ADD VALUE 'REDELIVERY_FEE_PAID';
ALTER TYPE "CaseEventType" ADD VALUE 'DELIVERY_RECEIVED';
ALTER TYPE "CaseEventType" ADD VALUE 'ALERT_BOOK_COURIER';
ALTER TYPE "CaseEventType" ADD VALUE 'ALERT_PHARMACY_UNCONFIRMED';
ALTER TYPE "CaseEventType" ADD VALUE 'ALERT_DELIVERY_LATE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MedicationOrderStatus" ADD VALUE 'READY_FOR_PICKUP';
ALTER TYPE "MedicationOrderStatus" ADD VALUE 'DELIVERY_FAILED';

-- AlterTable
ALTER TABLE "medication_order" ADD COLUMN     "alert_book_courier_at" TIMESTAMP(3),
ADD COLUMN     "alert_late_at" TIMESTAMP(3),
ADD COLUMN     "alert_pharmacy_at" TIMESTAMP(3),
ADD COLUMN     "promised_by" TIMESTAMP(3),
ADD COLUMN     "ready_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "medication_delivery" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "courier_service" TEXT NOT NULL DEFAULT 'YANGO',
    "tracking_url" TEXT,
    "booking_ref" TEXT,
    "cost_xof" INTEGER,
    "eta_at" TIMESTAMP(3),
    "courier_name" TEXT,
    "courier_phone" TEXT,
    "collect_original" BOOLEAN NOT NULL DEFAULT false,
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "booked_by_id" UUID,
    "original_collected_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "delivered_confirmed_by" TEXT,
    "delivered_note" TEXT,
    "failed_at" TIMESTAMP(3),
    "fail_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_order_charge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'REDELIVERY',
    "amount_xof" INTEGER NOT NULL,
    "status" "OrderChargeStatus" NOT NULL DEFAULT 'DUE',
    "reason" TEXT,
    "waived_reason" TEXT,
    "waived_by_id" UUID,
    "waived_at" TIMESTAMP(3),
    "payment_method" "PaymentMethod",
    "payment_reference" TEXT,
    "reported_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "confirmed_by_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_order_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_message_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "body_fr" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_message_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medication_delivery_order_id_idx" ON "medication_delivery"("order_id");

-- CreateIndex
CREATE INDEX "medication_order_charge_order_id_idx" ON "medication_order_charge"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_message_template_code_key" ON "member_message_template"("code");

-- AddForeignKey
ALTER TABLE "medication_delivery" ADD CONSTRAINT "medication_delivery_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "medication_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_charge" ADD CONSTRAINT "medication_order_charge_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "medication_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Delivery settings (Admin > Value lists > Medication delivery settings).
INSERT INTO "medication_delivery_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES
  ('COURIER_BOOKING_ALERT_MINUTES', 'Remind staff to book the courier after (minutes ready)', 'Rappeler de réserver le coursier après (minutes prêt)', 20, 40, CURRENT_TIMESTAMP),
  ('PHARMACY_CONFIRM_ALERT_MINUTES', 'Alert if the pharmacy hasn''t confirmed payment after (minutes)', 'Alerter si la pharmacie n''a pas confirmé le paiement après (minutes)', 30, 41, CURRENT_TIMESTAMP),
  ('PHARMACY_LINK_DAYS', 'Pharmacy link stays open after Nomad pays it (days)', 'Le lien pharmacie reste ouvert après le paiement (jours)', 3, 42, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Automatic messages in the member's chat (Admin > Value lists > Medication
-- delivery > Automatic messages). Drafts for Nomad to review.
INSERT INTO "member_message_template" ("code", "label_en", "body_en", "body_fr", "sort_order", "updated_at") VALUES
  ('ORDER_RECEIVED', 'Order received',
   'We''ve received your order {reference}. We''re asking pharmacies near you for their price and will send it to you here.',
   'Nous avons bien reçu votre commande {reference}. Nous demandons leurs prix aux pharmacies proches de vous et vous l''envoyons ici.', 1, CURRENT_TIMESTAMP),
  ('PRICE_READY', 'Price ready',
   'Your price is ready: {total}. Please approve it in your order so we can go ahead.',
   'Votre prix est prêt : {total}. Merci de l''accepter dans votre commande pour que nous puissions continuer.', 2, CURRENT_TIMESTAMP),
  ('PAYMENT_RECEIVED', 'Payment received',
   'We''ve received your payment of {total}. Thank you! The pharmacy is now preparing your order. {deliverBy}',
   'Nous avons bien reçu votre paiement de {total}. Merci ! La pharmacie prépare maintenant votre commande. {deliverBy}', 3, CURRENT_TIMESTAMP),
  ('READY_FOR_PICKUP', 'Ready at the pharmacy',
   'Your order is ready at the pharmacy. We''re booking a courier.',
   'Votre commande est prête à la pharmacie. Nous réservons un coursier.', 4, CURRENT_TIMESTAMP),
  ('COURIER_BOOKED', 'Courier booked',
   'A courier has been booked{eta}. Tap "Follow my delivery" in your order to track it.',
   'Un coursier a été réservé{eta}. Touchez « Suivre ma livraison » dans votre commande pour la suivre.', 5, CURRENT_TIMESTAMP),
  ('COURIER_BOOKED_ORIGINAL', 'Courier booked (collects the paper prescription first)',
   'A courier has been booked{eta}. They will first come to you to collect the original prescription, take it to the pharmacy, then bring your medication back to you. Please have the original prescription ready.',
   'Un coursier a été réservé{eta}. Il passera d''abord chez vous récupérer l''ordonnance originale, l''apportera à la pharmacie, puis vous rapportera vos médicaments. Merci de préparer l''ordonnance originale.', 6, CURRENT_TIMESTAMP),
  ('ON_THE_WAY', 'On the way',
   'Your medication has been picked up and is on its way to you.',
   'Vos médicaments ont été récupérés et sont en route vers vous.', 7, CURRENT_TIMESTAMP),
  ('DELIVERED', 'Delivered',
   'Your order has been delivered. Thank you for choosing Nomad!',
   'Votre commande a été livrée. Merci d''avoir choisi Nomad !', 8, CURRENT_TIMESTAMP),
  ('DELIVERY_FAILED', 'Delivery failed — fee due',
   'We couldn''t deliver your order ({reason}). A new delivery costs {fee}: pay it in your order and we''ll book a new courier.',
   'Nous n''avons pas pu livrer votre commande ({reason}). Une nouvelle livraison coûte {fee} : réglez-la dans votre commande et nous réserverons un nouveau coursier.', 9, CURRENT_TIMESTAMP),
  ('FEE_WAIVED', 'Re-delivery fee cancelled',
   'Good news: the re-delivery fee has been cancelled. We''re booking a new courier.',
   'Bonne nouvelle : les frais de nouvelle livraison ont été annulés. Nous réservons un nouveau coursier.', 10, CURRENT_TIMESTAMP),
  ('FEE_PAID', 'Re-delivery fee paid',
   'We''ve received your payment for the new delivery. We''re booking a courier.',
   'Nous avons bien reçu votre paiement pour la nouvelle livraison. Nous réservons un coursier.', 11, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
