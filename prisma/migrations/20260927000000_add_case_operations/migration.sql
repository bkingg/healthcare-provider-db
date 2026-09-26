-- Step 1.3 (Nomad MVP): operations dashboard. Case timeline (including
-- messages with members), provider shortlist per case, admin-editable
-- response times per colour, case assignment/due-time fields, and a
-- canWorkCases permission on staff roles.

-- CreateEnum
CREATE TYPE "CaseEventType" AS ENUM ('CREATED', 'COLOUR_SET', 'COLOUR_OVERRIDDEN', 'ESCALATED', 'ASSIGNED', 'STATUS_CHANGED', 'NOTE', 'MESSAGE_TO_MEMBER', 'MESSAGE_FROM_MEMBER', 'PROVIDERS_FOUND', 'PROVIDER_SELECTED');

-- CreateEnum
CREATE TYPE "CaseActorType" AS ENUM ('MEMBER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CaseProviderSource" AS ENUM ('SEARCH', 'STAFF');

-- AlterTable
ALTER TABLE "care_case" ADD COLUMN     "assigned_to_id" UUID,
ADD COLUMN     "member_last_seen_at" TIMESTAMP(3),
ADD COLUMN     "rag_overridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "response_due_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_role" ADD COLUMN     "can_work_cases" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "case_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "type" "CaseEventType" NOT NULL,
    "actor_type" "CaseActorType" NOT NULL,
    "staff_id" UUID,
    "member_id" UUID,
    "body" TEXT,
    "data" JSONB,
    "visible_to_member" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_provider_option" (
    "case_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "distance_km" DOUBLE PRECISION,
    "source" "CaseProviderSource" NOT NULL DEFAULT 'SEARCH',
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_provider_option_pkey" PRIMARY KEY ("case_id","provider_id")
);

-- CreateTable
CREATE TABLE "case_response_target" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "minutes" INTEGER NOT NULL,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_response_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_event_case_id_created_at_idx" ON "case_event"("case_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "case_response_target_code_key" ON "case_response_target"("code");

-- CreateIndex
CREATE INDEX "care_case_assigned_to_id_idx" ON "care_case"("assigned_to_id");

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_provider_option" ADD CONSTRAINT "case_provider_option_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_provider_option" ADD CONSTRAINT "case_provider_option_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: default response times (editable in Admin > Value lists > Response
-- times). Red runs on the 24/7 on-call clock; yellow and green count office
-- hours only (Mon–Fri 09:00–17:00 Dakar).
INSERT INTO "case_response_target" ("code", "label_en", "label_fr", "minutes", "business_hours_only", "updated_at") VALUES
  ('RED', 'Red · urgent', 'Rouge · urgent', 15, false, CURRENT_TIMESTAMP),
  ('YELLOW', 'Yellow · needs attention', 'Jaune · à surveiller', 120, true, CURRENT_TIMESTAMP),
  ('GREEN', 'Green · on track', 'Vert · en bonne voie', 480, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Data: Case Managers and Site Administrators work cases.
UPDATE "user_role" SET "can_work_cases" = true WHERE "code" IN ('SITE_ADMIN', 'CASE_MANAGER');
