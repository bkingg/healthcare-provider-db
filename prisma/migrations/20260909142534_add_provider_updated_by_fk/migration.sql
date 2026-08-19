-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
