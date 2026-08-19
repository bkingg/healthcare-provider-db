-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'SUSPENDED', 'CLOSED', 'DO_NOT_USE');

-- CreateEnum
CREATE TYPE "OperatingStatus" AS ENUM ('OPERATING', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CoordinateStatus" AS ENUM ('MISSING', 'DEFAULT', 'UNCONFIRMED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ProviderNameType" AS ENUM ('LEGAL', 'DISPLAY', 'BILLING', 'LOCAL', 'ALIAS');

-- CreateEnum
CREATE TYPE "ProviderTypeLevel" AS ENUM ('CATEGORY', 'TYPE', 'SUBTYPE', 'SERVICE_GROUP');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'STAGED', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'RECONCILED', 'FAILED');

-- CreateEnum
CREATE TYPE "DqSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DqStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DqResolution" AS ENUM ('ACCEPT', 'CORRECT', 'REJECT', 'MERGE', 'IGNORE');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "StagingValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED', 'COMMITTED');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "field_name" TEXT,
    "action" "AuditAction" NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "import_batch_id" UUID,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "credential_type_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "document_url" TEXT,
    "issued_date" DATE,
    "validation_date" DATE,
    "reviewed_by" UUID,
    "expiration_date" DATE,
    "renewal_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_contract" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "terms" TEXT,
    "document_url" TEXT,
    "comments" TEXT,
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "network_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "related_provider_id" UUID NOT NULL,
    "affiliation_type_id" UUID NOT NULL,
    "effective_date" DATE,
    "end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "affiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banking_payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "payee_name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payment_type_id" UUID NOT NULL,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_routing_or_swift" TEXT,
    "bank_account_type_id" UUID,
    "country_specific_fields" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "banking_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "source" TEXT,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_name" TEXT NOT NULL,
    "loaded_by" UUID NOT NULL,
    "loaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_record_count" INTEGER NOT NULL DEFAULT 0,
    "staged_count" INTEGER NOT NULL DEFAULT 0,
    "approved_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "exception_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "reconciled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_staging" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_provider_name" TEXT,
    "raw_provider_type_code" TEXT,
    "raw_active_indicator" TEXT,
    "raw_country_code" TEXT,
    "raw_city" TEXT,
    "raw_address_line1" TEXT,
    "raw_phone" TEXT,
    "raw_phone_type" TEXT,
    "raw_email" TEXT,
    "raw_latitude" TEXT,
    "raw_longitude" TEXT,
    "raw_external_id" TEXT,
    "matched_provider_id" UUID,
    "validation_status" "StagingValidationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_exception" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_batch_id" UUID,
    "staging_row_id" UUID,
    "provider_id" UUID,
    "field_name" TEXT,
    "field_value" TEXT,
    "rule_id" UUID NOT NULL,
    "severity" "DqSeverity" NOT NULL,
    "owner_id" UUID,
    "status" "DqStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_decision" "DqResolution",
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_quality_exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_visit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "reviewed_by" UUID NOT NULL,
    "findings" TEXT,
    "action_items" TEXT,
    "document_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "provider_visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_attachment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "file_url" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "retention_class_id" UUID NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "owner_id" UUID NOT NULL,
    "effective_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "note_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_type_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "operating_status" "OperatingStatus" NOT NULL DEFAULT 'UNKNOWN',
    "profile_summary" TEXT,
    "overall_rating_id" UUID,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_name" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "name_type" "ProviderNameType" NOT NULL,
    "organization_name" TEXT,
    "facility_name" TEXT,
    "individual_first_name" TEXT,
    "individual_middle_name" TEXT,
    "individual_last_name" TEXT,
    "individual_suffix" TEXT,
    "full_name_text" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "search_vector" tsvector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "provider_name_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "address_type_id" UUID NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state_province" TEXT,
    "postal_code" TEXT,
    "country_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "coordinate_status" "CoordinateStatus" NOT NULL DEFAULT 'MISSING',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "phone_type_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "extension" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "phone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "email_type_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administrative_contact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "title" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "job_title" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "administrative_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_specialty" (
    "provider_id" UUID NOT NULL,
    "specialty_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_specialty_pkey" PRIMARY KEY ("provider_id","specialty_id")
);

-- CreateTable
CREATE TABLE "provider_language" (
    "provider_id" UUID NOT NULL,
    "language_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_language_pkey" PRIMARY KEY ("provider_id","language_id")
);

-- CreateTable
CREATE TABLE "provider_capability" (
    "provider_id" UUID NOT NULL,
    "capability_id" UUID NOT NULL,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_capability_pkey" PRIMARY KEY ("provider_id","capability_id")
);

-- CreateTable
CREATE TABLE "region_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "region_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "region_id" UUID,
    "geo_region" TEXT,
    "quality_rating_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "level" "ProviderTypeLevel" NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialty" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credential_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_status_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credential_status_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_account_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_scale_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "numeric_value" DECIMAL(4,2),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_scale_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliation_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliation_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_category_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_category_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_class_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retention_period_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_class_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_type_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_type_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dq_rule_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "default_severity" "DqSeverity" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dq_rule_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_changed_at_idx" ON "audit_log"("changed_at");

-- CreateIndex
CREATE INDEX "credential_provider_id_idx" ON "credential"("provider_id");

-- CreateIndex
CREATE INDEX "credential_expiration_date_idx" ON "credential"("expiration_date");

-- CreateIndex
CREATE INDEX "network_contract_provider_id_idx" ON "network_contract"("provider_id");

-- CreateIndex
CREATE INDEX "network_contract_status_idx" ON "network_contract"("status");

-- CreateIndex
CREATE INDEX "affiliation_provider_id_idx" ON "affiliation"("provider_id");

-- CreateIndex
CREATE INDEX "affiliation_related_provider_id_idx" ON "affiliation"("related_provider_id");

-- CreateIndex
CREATE INDEX "banking_payment_provider_id_idx" ON "banking_payment"("provider_id");

-- CreateIndex
CREATE INDEX "rate_provider_id_idx" ON "rate"("provider_id");

-- CreateIndex
CREATE INDEX "provider_staging_import_batch_id_idx" ON "provider_staging"("import_batch_id");

-- CreateIndex
CREATE INDEX "data_quality_exception_import_batch_id_idx" ON "data_quality_exception"("import_batch_id");

-- CreateIndex
CREATE INDEX "data_quality_exception_provider_id_idx" ON "data_quality_exception"("provider_id");

-- CreateIndex
CREATE INDEX "data_quality_exception_status_idx" ON "data_quality_exception"("status");

-- CreateIndex
CREATE INDEX "provider_visit_provider_id_idx" ON "provider_visit"("provider_id");

-- CreateIndex
CREATE INDEX "note_attachment_provider_id_idx" ON "note_attachment"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_external_id_key" ON "provider"("external_id");

-- CreateIndex
CREATE INDEX "provider_status_idx" ON "provider"("status");

-- CreateIndex
CREATE INDEX "provider_country_id_idx" ON "provider"("country_id");

-- CreateIndex
CREATE INDEX "provider_provider_type_id_idx" ON "provider"("provider_type_id");

-- CreateIndex
CREATE INDEX "provider_name_provider_id_idx" ON "provider_name"("provider_id");

-- CreateIndex
CREATE INDEX "provider_name_full_name_text_idx" ON "provider_name"("full_name_text");

-- CreateIndex
CREATE INDEX "address_provider_id_idx" ON "address"("provider_id");

-- CreateIndex
CREATE INDEX "address_country_id_city_idx" ON "address"("country_id", "city");

-- CreateIndex
CREATE INDEX "phone_provider_id_idx" ON "phone"("provider_id");

-- CreateIndex
CREATE INDEX "email_provider_id_idx" ON "email"("provider_id");

-- CreateIndex
CREATE INDEX "administrative_contact_provider_id_idx" ON "administrative_contact"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "region_ref_code_key" ON "region_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "country_ref_iso2_key" ON "country_ref"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "provider_type_ref_code_key" ON "provider_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "specialty_code_key" ON "specialty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "language_code_key" ON "language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "capability_code_key" ON "capability"("code");

-- CreateIndex
CREATE UNIQUE INDEX "address_type_ref_code_key" ON "address_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "phone_type_ref_code_key" ON "phone_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "email_type_ref_code_key" ON "email_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "credential_type_ref_code_key" ON "credential_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "credential_status_ref_code_key" ON "credential_status_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "network_ref_code_key" ON "network_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_type_ref_code_key" ON "payment_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_type_ref_code_key" ON "bank_account_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rating_scale_ref_code_key" ON "rating_scale_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliation_type_ref_code_key" ON "affiliation_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "document_category_ref_code_key" ON "document_category_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "retention_class_ref_code_key" ON "retention_class_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_type_ref_code_key" ON "service_type_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dq_rule_ref_code_key" ON "dq_rule_ref"("code");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_credential_type_id_fkey" FOREIGN KEY ("credential_type_id") REFERENCES "credential_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "credential_status_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_contract" ADD CONSTRAINT "network_contract_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_contract" ADD CONSTRAINT "network_contract_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "network_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_contract" ADD CONSTRAINT "network_contract_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_related_provider_id_fkey" FOREIGN KEY ("related_provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_affiliation_type_id_fkey" FOREIGN KEY ("affiliation_type_id") REFERENCES "affiliation_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banking_payment" ADD CONSTRAINT "banking_payment_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banking_payment" ADD CONSTRAINT "banking_payment_payment_type_id_fkey" FOREIGN KEY ("payment_type_id") REFERENCES "payment_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banking_payment" ADD CONSTRAINT "banking_payment_bank_account_type_id_fkey" FOREIGN KEY ("bank_account_type_id") REFERENCES "bank_account_type_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banking_payment" ADD CONSTRAINT "banking_payment_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate" ADD CONSTRAINT "rate_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate" ADD CONSTRAINT "rate_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate" ADD CONSTRAINT "rate_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_loaded_by_fkey" FOREIGN KEY ("loaded_by") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_staging" ADD CONSTRAINT "provider_staging_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_staging" ADD CONSTRAINT "provider_staging_matched_provider_id_fkey" FOREIGN KEY ("matched_provider_id") REFERENCES "provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_exception" ADD CONSTRAINT "data_quality_exception_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_exception" ADD CONSTRAINT "data_quality_exception_staging_row_id_fkey" FOREIGN KEY ("staging_row_id") REFERENCES "provider_staging"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_exception" ADD CONSTRAINT "data_quality_exception_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_exception" ADD CONSTRAINT "data_quality_exception_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "dq_rule_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_exception" ADD CONSTRAINT "data_quality_exception_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_exception" ADD CONSTRAINT "data_quality_exception_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_visit" ADD CONSTRAINT "provider_visit_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_visit" ADD CONSTRAINT "provider_visit_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_category_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_retention_class_id_fkey" FOREIGN KEY ("retention_class_id") REFERENCES "retention_class_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "provider_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_overall_rating_id_fkey" FOREIGN KEY ("overall_rating_id") REFERENCES "rating_scale_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_name" ADD CONSTRAINT "provider_name_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_address_type_id_fkey" FOREIGN KEY ("address_type_id") REFERENCES "address_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone" ADD CONSTRAINT "phone_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone" ADD CONSTRAINT "phone_phone_type_id_fkey" FOREIGN KEY ("phone_type_id") REFERENCES "phone_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "email_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "email_email_type_id_fkey" FOREIGN KEY ("email_type_id") REFERENCES "email_type_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administrative_contact" ADD CONSTRAINT "administrative_contact_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_specialty" ADD CONSTRAINT "provider_specialty_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_specialty" ADD CONSTRAINT "provider_specialty_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_language" ADD CONSTRAINT "provider_language_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_language" ADD CONSTRAINT "provider_language_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_capability" ADD CONSTRAINT "provider_capability_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_capability" ADD CONSTRAINT "provider_capability_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_ref" ADD CONSTRAINT "country_ref_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "region_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_ref" ADD CONSTRAINT "country_ref_quality_rating_id_fkey" FOREIGN KEY ("quality_rating_id") REFERENCES "rating_scale_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_type_ref" ADD CONSTRAINT "provider_type_ref_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "provider_type_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;
