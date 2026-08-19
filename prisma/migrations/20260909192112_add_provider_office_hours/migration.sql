-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "provider_office_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "open_time" TIME NOT NULL,
    "close_time" TIME NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "provider_office_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_office_hours_provider_id_idx" ON "provider_office_hours"("provider_id");

-- AddForeignKey
ALTER TABLE "provider_office_hours" ADD CONSTRAINT "provider_office_hours_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
