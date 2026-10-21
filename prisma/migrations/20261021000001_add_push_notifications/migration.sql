-- AlterTable
ALTER TABLE "case_event" ADD COLUMN     "pushed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "staff_notification" ADD COLUMN     "pushed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "member_id" UUID,
    "user_id" UUID,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "user_agent" TEXT,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscription_member_id_idx" ON "push_subscription"("member_id");

-- CreateIndex
CREATE INDEX "push_subscription_user_id_idx" ON "push_subscription"("user_id");

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nothing from before alerts existed is sent.
UPDATE "staff_notification" SET "pushed_at" = CURRENT_TIMESTAMP WHERE "pushed_at" IS NULL;
UPDATE "case_event" SET "pushed_at" = CURRENT_TIMESTAMP WHERE "type" = 'MESSAGE_TO_MEMBER' AND "pushed_at" IS NULL;
