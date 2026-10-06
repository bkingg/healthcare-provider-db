-- Medication delivery, step 2: member medication orders (items, delivery,
-- documents) and private file storage records.

-- CreateEnum
CREATE TYPE "MedicationOrderStatus" AS ENUM ('REQUESTED', 'SEARCHING_PHARMACIES', 'PHARMACY_CONFIRMED', 'PRICE_CONFIRMED', 'AWAITING_APPROVAL', 'AWAITING_PAYMENT', 'PAID', 'PREPARING', 'COURIER_REQUESTED', 'ORIGINAL_COLLECTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "stored_file" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_by_member_id" UUID,
    "uploaded_by_staff_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "MedicationOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "delivery_address" TEXT NOT NULL,
    "delivery_latitude" DOUBLE PRECISION,
    "delivery_longitude" DOUBLE PRECISION,
    "delivery_notes" TEXT,
    "member_note" TEXT,
    "needs_prescription" BOOLEAN NOT NULL DEFAULT false,
    "has_narcotic" BOOLEAN NOT NULL DEFAULT false,
    "has_psychotropic" BOOLEAN NOT NULL DEFAULT false,
    "has_cold_chain" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_order_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "medication_id" UUID,
    "free_text" TEXT,
    "dci" TEXT,
    "brand_name" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "regulatory_class" "MedicationRegulatoryClass",
    "is_psychotropic" BOOLEAN NOT NULL DEFAULT false,
    "is_cold_chain" BOOLEAN NOT NULL DEFAULT false,
    "prescription_required" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "medication_order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_order_document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "requirement_code" TEXT NOT NULL,
    "file_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_order_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_file_storage_key_key" ON "stored_file"("storage_key");

-- CreateIndex
CREATE INDEX "stored_file_uploaded_by_member_id_created_at_idx" ON "stored_file"("uploaded_by_member_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "medication_order_case_id_key" ON "medication_order"("case_id");

-- CreateIndex
CREATE INDEX "medication_order_status_idx" ON "medication_order"("status");

-- CreateIndex
CREATE INDEX "medication_order_line_order_id_idx" ON "medication_order_line"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "medication_order_document_file_id_key" ON "medication_order_document"("file_id");

-- CreateIndex
CREATE INDEX "medication_order_document_order_id_idx" ON "medication_order_document"("order_id");

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_uploaded_by_member_id_fkey" FOREIGN KEY ("uploaded_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_uploaded_by_staff_id_fkey" FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order" ADD CONSTRAINT "medication_order_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order" ADD CONSTRAINT "medication_order_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_line" ADD CONSTRAINT "medication_order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "medication_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_line" ADD CONSTRAINT "medication_order_line_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_document" ADD CONSTRAINT "medication_order_document_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "medication_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_order_document" ADD CONSTRAINT "medication_order_document_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_file"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

