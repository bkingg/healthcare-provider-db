-- AlterTable
ALTER TABLE "member" ADD COLUMN     "consent_at" TIMESTAMP(3),
ADD COLUMN     "consent_version" TEXT,
ADD COLUMN     "signup_source" TEXT;

-- CreateTable
CREATE TABLE "member_phone_code" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMP(3),
    "ticket_hash" TEXT,
    "ticket_expires_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_phone_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_phone_code_ticket_hash_key" ON "member_phone_code"("ticket_hash");

-- CreateIndex
CREATE INDEX "member_phone_code_phone_created_at_idx" ON "member_phone_code"("phone", "created_at");

-- CreateIndex
CREATE INDEX "member_phone_code_ip_hash_created_at_idx" ON "member_phone_code"("ip_hash", "created_at");

