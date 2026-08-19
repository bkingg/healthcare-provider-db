-- Department becomes an admin-managed value list instead of free text on
-- administrative contacts. Existing free-text values are kept: each distinct
-- one becomes a list entry (code = upper snake case, so "Medical Records"
-- and the seed's MEDICAL_RECORDS are the same row) and the contact is linked
-- to it before the old column is dropped.
CREATE TABLE "department_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_ref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "department_ref_code_key" ON "department_ref"("code");

ALTER TABLE "administrative_contact" ADD COLUMN "department_id" UUID;

INSERT INTO "department_ref" ("code", "name", "updated_at")
SELECT DISTINCT ON (upper(regexp_replace(btrim("department"), '[^A-Za-z0-9]+', '_', 'g')))
       upper(regexp_replace(btrim("department"), '[^A-Za-z0-9]+', '_', 'g')),
       btrim("department"),
       CURRENT_TIMESTAMP
FROM "administrative_contact"
WHERE "department" IS NOT NULL AND btrim("department") <> ''
ORDER BY upper(regexp_replace(btrim("department"), '[^A-Za-z0-9]+', '_', 'g')), btrim("department");

UPDATE "administrative_contact" ac
SET "department_id" = d."id"
FROM "department_ref" d
WHERE ac."department" IS NOT NULL AND btrim(ac."department") <> ''
  AND d."code" = upper(regexp_replace(btrim(ac."department"), '[^A-Za-z0-9]+', '_', 'g'));

ALTER TABLE "administrative_contact" DROP COLUMN "department";

ALTER TABLE "administrative_contact" ADD CONSTRAINT "administrative_contact_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;
