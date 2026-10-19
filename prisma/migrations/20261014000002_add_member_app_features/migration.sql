-- CreateTable
CREATE TABLE "member_app_feature" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_app_feature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_app_feature_code_key" ON "member_app_feature"("code");


-- Only medication orders are offered for now; Request help is held back
-- (switch on in Admin > Value lists > Member app features).
INSERT INTO "member_app_feature" ("code", "label_en", "label_fr", "enabled", "sort_order", "updated_at") VALUES
  ('ORDER_MEDICATION', 'Order medication', 'Commander des médicaments', true, 1, CURRENT_TIMESTAMP),
  ('REQUEST_HELP', 'Request help (doctors, appointments, urgent care…)', 'Demander de l''aide (médecins, rendez-vous, soins urgents…)', false, 2, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
