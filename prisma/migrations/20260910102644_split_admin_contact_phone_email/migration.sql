-- CreateTable
CREATE TABLE "administrative_contact_phone" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "administrative_contact_phone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administrative_contact_email" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "administrative_contact_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "administrative_contact_phone_contact_id_idx" ON "administrative_contact_phone"("contact_id");

-- CreateIndex
CREATE INDEX "administrative_contact_email_contact_id_idx" ON "administrative_contact_email"("contact_id");

-- AddForeignKey
ALTER TABLE "administrative_contact_phone" ADD CONSTRAINT "administrative_contact_phone_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "administrative_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administrative_contact_email" ADD CONSTRAINT "administrative_contact_email_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "administrative_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing scalar phone/email values into the new child tables
-- before dropping the columns that held them.
INSERT INTO "administrative_contact_phone" ("contact_id", "number", "created_by")
SELECT "id", "phone", "created_by" FROM "administrative_contact" WHERE "phone" IS NOT NULL AND "phone" <> '';

INSERT INTO "administrative_contact_email" ("contact_id", "address", "created_by")
SELECT "id", "email", "created_by" FROM "administrative_contact" WHERE "email" IS NOT NULL AND "email" <> '';

-- AlterTable
ALTER TABLE "administrative_contact" DROP COLUMN "phone",
DROP COLUMN "email";
