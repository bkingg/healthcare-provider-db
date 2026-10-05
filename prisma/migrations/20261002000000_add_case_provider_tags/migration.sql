-- Providers (facilities) a member is actively using, tagged to a case by staff.

-- AlterEnum
ALTER TYPE "CaseEventType" ADD VALUE 'PROVIDER_TAGGED';
ALTER TYPE "CaseEventType" ADD VALUE 'PROVIDER_UNTAGGED';

-- CreateTable
CREATE TABLE "case_provider_tag" (
    "case_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "tagged_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_provider_tag_pkey" PRIMARY KEY ("case_id","provider_id")
);

-- CreateIndex
CREATE INDEX "case_provider_tag_provider_id_idx" ON "case_provider_tag"("provider_id");

-- AddForeignKey
ALTER TABLE "case_provider_tag" ADD CONSTRAINT "case_provider_tag_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_provider_tag" ADD CONSTRAINT "case_provider_tag_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_provider_tag" ADD CONSTRAINT "case_provider_tag_tagged_by_id_fkey" FOREIGN KEY ("tagged_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
