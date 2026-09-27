-- CreateEnum
CREATE TYPE "StaffNotificationKind" AS ENUM ('MENTION', 'ACTION_ASSIGNED');
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "CaseEventType" ADD VALUE 'ACTION_ADDED';
ALTER TYPE "CaseEventType" ADD VALUE 'ACTION_DONE';
ALTER TYPE "CaseEventType" ADD VALUE 'ACTION_REOPENED';
ALTER TYPE "CaseEventType" ADD VALUE 'ACTIONS_CLOSED_WITH_CASE';
-- CreateTable
CREATE TABLE "case_action" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" UUID,
    "closed_with_case" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_action_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "case_mention" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_mention_pkey" PRIMARY KEY ("event_id","user_id")
);
-- CreateTable
CREATE TABLE "staff_notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" "StaffNotificationKind" NOT NULL,
    "case_id" UUID NOT NULL,
    "event_id" UUID,
    "action_id" UUID,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    CONSTRAINT "staff_notification_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "case_action_owner_id_completed_at_due_at_idx" ON "case_action"("owner_id", "completed_at", "due_at");
-- CreateIndex
CREATE INDEX "case_action_case_id_completed_at_idx" ON "case_action"("case_id", "completed_at");
-- CreateIndex
CREATE INDEX "case_mention_user_id_created_at_idx" ON "case_mention"("user_id", "created_at");
-- CreateIndex
CREATE INDEX "staff_notification_user_id_read_at_created_at_idx" ON "staff_notification"("user_id", "read_at", "created_at");
-- AddForeignKey
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "case_mention" ADD CONSTRAINT "case_mention_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "case_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "case_mention" ADD CONSTRAINT "case_mention_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "staff_notification" ADD CONSTRAINT "staff_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "staff_notification" ADD CONSTRAINT "staff_notification_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "staff_notification" ADD CONSTRAINT "staff_notification_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "case_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "staff_notification" ADD CONSTRAINT "staff_notification_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "case_action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "staff_notification" ADD CONSTRAINT "staff_notification_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
