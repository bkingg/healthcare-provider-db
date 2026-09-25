-- Step 1.2 (Nomad MVP): member sign-in (one-time links and sessions),
-- help requests (care_case) with a rules-based colour, and the request
-- categories and emergency numbers the member app shows. New tables only.

-- CreateEnum
CREATE TYPE "CaseUrgency" AS ENUM ('EMERGENCY', 'TODAY', 'THIS_WEEK', 'ROUTINE');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_MEMBER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CaseRag" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "CaseChannel" AS ENUM ('MEMBER_APP', 'STAFF');

-- CreateEnum
CREATE TYPE "EmergencyContactKind" AS ENUM ('PUBLIC', 'NOMAD');

-- CreateTable
CREATE TABLE "member_login_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_login_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_case" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_number" SERIAL NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_has_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "urgency" "CaseUrgency" NOT NULL,
    "location_label" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "rag" "CaseRag" NOT NULL,
    "rag_reasons" TEXT[],
    "channel" "CaseChannel" NOT NULL DEFAULT 'MEMBER_APP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_category_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_fr" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_category_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contact_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "phone" TEXT NOT NULL,
    "kind" "EmergencyContactKind" NOT NULL DEFAULT 'PUBLIC',
    "country_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contact_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_login_token_token_hash_key" ON "member_login_token"("token_hash");

-- CreateIndex
CREATE INDEX "member_login_token_member_id_created_at_idx" ON "member_login_token"("member_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "member_session_token_hash_key" ON "member_session"("token_hash");

-- CreateIndex
CREATE INDEX "member_session_member_id_idx" ON "member_session"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "care_case_case_number_key" ON "care_case"("case_number");

-- CreateIndex
CREATE INDEX "care_case_rag_status_idx" ON "care_case"("rag", "status");

-- CreateIndex
CREATE INDEX "care_case_requested_by_id_idx" ON "care_case"("requested_by_id");

-- CreateIndex
CREATE INDEX "care_case_patient_id_idx" ON "care_case"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_category_ref_code_key" ON "case_category_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contact_ref_code_key" ON "emergency_contact_ref"("code");

-- AddForeignKey
ALTER TABLE "member_login_token" ADD CONSTRAINT "member_login_token_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_session" ADD CONSTRAINT "member_session_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "case_category_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contact_ref" ADD CONSTRAINT "emergency_contact_ref_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;
