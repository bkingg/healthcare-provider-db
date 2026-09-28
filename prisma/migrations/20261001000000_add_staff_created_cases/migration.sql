-- Staff-created cases (phone, email, WhatsApp, walk-in) and special requests
-- for people Nomad helps without cover.

-- CreateEnum
CREATE TYPE "CaseCoverage" AS ENUM ('COVERED', 'SPECIAL_FREE', 'SPECIAL_PAID');

-- AlterEnum
ALTER TYPE "CaseChannel" ADD VALUE 'PHONE';
ALTER TYPE "CaseChannel" ADD VALUE 'EMAIL';
ALTER TYPE "CaseChannel" ADD VALUE 'WHATSAPP';
ALTER TYPE "CaseChannel" ADD VALUE 'WALK_IN';

-- AlterEnum
ALTER TYPE "CaseEventType" ADD VALUE 'COVERAGE_CHANGED';
ALTER TYPE "CaseEventType" ADD VALUE 'VISIBILITY_CHANGED';

-- AlterTable: existing cases were all contacted when they were created,
-- are covered, and are app requests the member already sees.
ALTER TABLE "care_case" ADD COLUMN     "contacted_at" TIMESTAMP(3),
ADD COLUMN     "coverage" "CaseCoverage" NOT NULL DEFAULT 'COVERED',
ADD COLUMN     "visible_to_member" BOOLEAN NOT NULL DEFAULT true;
UPDATE "care_case" SET "contacted_at" = "created_at";
ALTER TABLE "care_case" ALTER COLUMN "contacted_at" SET NOT NULL,
ALTER COLUMN "contacted_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "member" ADD COLUMN     "is_covered" BOOLEAN NOT NULL DEFAULT true;
