-- Admin-editable hover/help text for UI elements (e.g. the "Validate record" button).
CREATE TABLE "ui_hint_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_hint_ref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ui_hint_ref_code_key" ON "ui_hint_ref"("code");
