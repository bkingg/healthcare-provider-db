-- Medication ordering & delivery, step 1: the medication catalog and the
-- documents/handling each kind of medication needs.

-- CreateEnum
CREATE TYPE "MedicationRegulatoryClass" AS ENUM ('NOT_LISTED', 'LIST_II', 'LIST_I', 'NARCOTIC');

-- CreateEnum
CREATE TYPE "MedicationRequirementTrigger" AS ENUM ('PRESCRIPTION_REQUIRED', 'LIST_II', 'LIST_I', 'NARCOTIC', 'PSYCHOTROPIC', 'COLD_CHAIN');

-- CreateEnum
CREATE TYPE "MedicationRequirementKind" AS ENUM ('UPLOAD', 'ORIGINAL_TO_COLLECT', 'ID_DOCUMENT', 'HANDLING');

-- CreateTable
CREATE TABLE "medication" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "dci" TEXT NOT NULL,
    "brand_name" TEXT,
    "strength" TEXT,
    "form" TEXT NOT NULL,
    "presentation" TEXT,
    "therapeutic_class" TEXT,
    "regulatory_class" "MedicationRegulatoryClass" NOT NULL DEFAULT 'NOT_LISTED',
    "is_psychotropic" BOOLEAN NOT NULL DEFAULT false,
    "is_cold_chain" BOOLEAN NOT NULL DEFAULT false,
    "prescription_required" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_requirement_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_fr" TEXT,
    "description_en" TEXT,
    "description_fr" TEXT,
    "applies_to" "MedicationRequirementTrigger" NOT NULL,
    "kind" "MedicationRequirementKind" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_requirement_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medication_code_key" ON "medication"("code");

-- CreateIndex
CREATE INDEX "medication_dci_idx" ON "medication"("dci");

-- CreateIndex
CREATE INDEX "medication_brand_name_idx" ON "medication"("brand_name");

-- CreateIndex
CREATE UNIQUE INDEX "medication_requirement_ref_code_key" ON "medication_requirement_ref"("code");


-- Starting requirements — suggestions for Nomad's pharmacist to confirm,
-- editable in Admin > Value lists > Medication delivery.
INSERT INTO "medication_requirement_ref" ("code", "name_en", "name_fr", "description_en", "description_fr", "applies_to", "kind", "sort_order", "updated_at") VALUES
  ('PRESCRIPTION_PHOTO', 'Prescription (photo)', 'Ordonnance (photo)',
   'A clear photo of the prescription showing the patient''s name, the medication and dose, the date, and the prescriber''s signature and stamp.',
   'Une photo nette de l''ordonnance avec le nom du patient, le médicament et la posologie, la date, la signature et le cachet du prescripteur.',
   'PRESCRIPTION_REQUIRED', 'UPLOAD', 10, CURRENT_TIMESTAMP),
  ('NARCOTIC_ORIGINAL_PRESCRIPTION', 'Original narcotics prescription (carnet à souches)', 'Ordonnance originale de stupéfiants (carnet à souches)',
   'The original sheet from the prescriber''s carnet à souches. A photo isn''t enough: the courier collects the original before going to the pharmacy.',
   'La feuille originale du carnet à souches du prescripteur. Une photo ne suffit pas : le coursier récupère l''original avant de passer à la pharmacie.',
   'NARCOTIC', 'ORIGINAL_TO_COLLECT', 20, CURRENT_TIMESTAMP),
  ('NARCOTIC_PATIENT_ID', 'Patient''s ID', 'Pièce d''identité du patient',
   'The patient''s ID card or passport — and the bearer''s, if someone else receives the order.',
   'La carte d''identité ou le passeport du patient — et celle du porteur si quelqu''un d''autre reçoit la commande.',
   'NARCOTIC', 'ID_DOCUMENT', 30, CURRENT_TIMESTAMP),
  ('PSYCHOTROPIC_RECIPIENT_ID', 'Recipient''s ID at delivery', 'Pièce d''identité à la livraison',
   'The person receiving the order shows their ID to the courier.',
   'La personne qui reçoit la commande présente sa pièce d''identité au coursier.',
   'PSYCHOTROPIC', 'ID_DOCUMENT', 40, CURRENT_TIMESTAMP),
  ('COLD_CHAIN_HANDLING', 'Keep cold (2–8 °C)', 'Conserver au froid (2–8 °C)',
   'The pharmacy packs it with ice packs in an insulated bag; the courier delivers within 2 hours with no stops in between.',
   'La pharmacie l''emballe avec des pains de glace dans un sac isotherme ; le coursier livre en moins de 2 heures, sans arrêt intermédiaire.',
   'COLD_CHAIN', 'HANDLING', 50, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
