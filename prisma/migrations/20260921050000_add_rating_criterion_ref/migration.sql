-- Admin-editable hover text for the Quality / Access star ratings.
CREATE TABLE "rating_criterion_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level_1_meaning" TEXT,
    "level_2_meaning" TEXT,
    "level_3_meaning" TEXT,
    "level_4_meaning" TEXT,
    "level_5_meaning" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_criterion_ref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rating_criterion_ref_code_key" ON "rating_criterion_ref"("code");
