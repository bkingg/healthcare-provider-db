-- AlterTable
ALTER TABLE "medication" ADD COLUMN     "amm_number" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "official_price_xof" INTEGER,
ADD COLUMN     "price_status" TEXT,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "source_checked_on" DATE,
ADD COLUMN     "source_url" TEXT;

