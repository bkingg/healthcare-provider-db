-- Step 1.1 (Nomad MVP): members and dependents, the organizations
-- (employers/insurers) they come through, dependent relationship types, and
-- a canManageMembers permission on staff roles. New tables only; the one
-- change to an existing table is the new user_role column.

-- CreateEnum
CREATE TYPE "MemberSex" AS ENUM ('FEMALE', 'MALE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('EMPLOYER', 'INSURER', 'OTHER');

-- AlterTable
ALTER TABLE "user_role" ADD COLUMN     "can_manage_members" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "member" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_number" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" DATE,
    "sex" "MemberSex" NOT NULL DEFAULT 'UNSPECIFIED',
    "email" TEXT,
    "phone" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'fr',
    "country_id" UUID,
    "city" TEXT,
    "primary_member_id" UUID,
    "relationship_id" UUID,
    "organization_id" UUID,
    "plan_name" TEXT,
    "policy_number" TEXT,
    "coverage_start" DATE,
    "coverage_end" DATE,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OrganizationKind" NOT NULL DEFAULT 'EMPLOYER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_relationship_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_fr" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_relationship_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_member_number_key" ON "member"("member_number");

-- CreateIndex
CREATE UNIQUE INDEX "member_email_key" ON "member"("email");

-- CreateIndex
CREATE INDEX "member_primary_member_id_idx" ON "member"("primary_member_id");

-- CreateIndex
CREATE INDEX "member_organization_id_idx" ON "member"("organization_id");

-- CreateIndex
CREATE INDEX "member_last_name_first_name_idx" ON "member"("last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ref_code_key" ON "organization_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "member_relationship_ref_code_key" ON "member_relationship_ref"("code");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_primary_member_id_fkey" FOREIGN KEY ("primary_member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "member_relationship_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: Site Administrators get the new permission so the Members screens
-- are reachable straight after migrating (every other role starts without
-- it and is granted in Admin > Value lists > Roles).
UPDATE "user_role" SET "can_manage_members" = true WHERE "code" = 'SITE_ADMIN';
