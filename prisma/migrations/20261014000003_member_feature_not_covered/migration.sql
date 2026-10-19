-- AlterTable
ALTER TABLE "member_app_feature" ADD COLUMN     "enabled_not_covered" BOOLEAN NOT NULL DEFAULT true;


-- Members without cover start with the same services as covered members.
UPDATE "member_app_feature" SET "enabled_not_covered" = "enabled";
