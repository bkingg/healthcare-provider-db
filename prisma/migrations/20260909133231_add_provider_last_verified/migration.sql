-- AlterTable
ALTER TABLE "provider" ADD COLUMN     "last_verified_at" TIMESTAMP(3),
ADD COLUMN     "last_verified_by" UUID;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_last_verified_by_fkey" FOREIGN KEY ("last_verified_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
