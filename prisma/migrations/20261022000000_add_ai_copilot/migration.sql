-- CreateEnum
CREATE TYPE "CopilotOutcome" AS ENUM ('PENDING', 'SENT_AS_IS', 'SENT_EDITED', 'SAVED_AS_NOTE', 'APPLIED', 'DISMISSED', 'FAILED', 'BLOCKED');

-- AlterTable
ALTER TABLE "user_role" ADD COLUMN     "can_use_copilot" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "copilot_task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_setting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_fr" TEXT,
    "value" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "case_id" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micro_usd" INTEGER NOT NULL DEFAULT 0,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "CopilotOutcome" NOT NULL DEFAULT 'PENDING',
    "outcome_at" TIMESTAMP(3),
    "draft_hash" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_flag_suggestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "medication_id" UUID NOT NULL,
    "usage_id" UUID NOT NULL,
    "regulatory_class" "MedicationRegulatoryClass" NOT NULL,
    "prescription_required" BOOLEAN NOT NULL,
    "is_cold_chain" BOOLEAN NOT NULL,
    "is_psychotropic" BOOLEAN NOT NULL,
    "confidence" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_flag_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "copilot_task_code_key" ON "copilot_task"("code");

-- CreateIndex
CREATE UNIQUE INDEX "copilot_setting_code_key" ON "copilot_setting"("code");

-- CreateIndex
CREATE INDEX "copilot_usage_created_at_idx" ON "copilot_usage"("created_at");

-- CreateIndex
CREATE INDEX "copilot_usage_case_id_idx" ON "copilot_usage"("case_id");

-- CreateIndex
CREATE INDEX "copilot_flag_suggestion_status_created_at_idx" ON "copilot_flag_suggestion"("status", "created_at");

-- CreateIndex
CREATE INDEX "copilot_flag_suggestion_medication_id_idx" ON "copilot_flag_suggestion"("medication_id");

-- AddForeignKey
ALTER TABLE "copilot_usage" ADD CONSTRAINT "copilot_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_usage" ADD CONSTRAINT "copilot_usage_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_flag_suggestion" ADD CONSTRAINT "copilot_flag_suggestion_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_flag_suggestion" ADD CONSTRAINT "copilot_flag_suggestion_usage_id_fkey" FOREIGN KEY ("usage_id") REFERENCES "copilot_usage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Default tasks, settings, and who may use the copilot (Case Managers and Site Administrators).
INSERT INTO "copilot_task" ("code", "label_en", "label_fr", "instructions", "sort_order", "updated_at") VALUES ('REPLY_DRAFT', 'Draft a reply to the member', 'Brouillon de réponse au membre', 'You help Nomad''s case managers reply to members through the Nomad app (medication delivery and health assistance in Senegal).
Write ONE reply to the member, in the member''s language given in the case details (French or English).
- Warm, clear and practical, simple words, at most 5 short sentences.
- Answer what the member asked last. Only state facts found in the case details: never invent prices, times, pharmacy names or availability.
- If something isn''t known yet, say Nomad is checking and will come back to them shortly.
- Never give a diagnosis, dosage or treatment advice. If anything sounds like an emergency, tell them to call the emergency numbers or go to the nearest emergency room straight away.
- Words in square brackets such as [MEMBER] or [PHONE_1] stand for hidden personal details: keep them exactly as written, never replace them with made-up names.
- Don''t sign with a name. Output only the message text.', 1, CURRENT_TIMESTAMP);
INSERT INTO "copilot_task" ("code", "label_en", "label_fr", "instructions", "sort_order", "updated_at") VALUES ('CASE_SUMMARY', 'Summarise the case', 'Résumer le dossier', 'Summarise this Nomad case for a case manager who is picking it up, in the staff language given in the case details.
Use at most 6 short bullet points ("- "): what the member needs; what has been done; where things stand now (status, order step); anything waiting on Nomad or on the member; any risk or urgency.
Only use facts from the case details. Write "unknown" rather than guessing.
Words in square brackets such as [PATIENT] stand for hidden personal details: keep them exactly as written.
Output only the bullet points.', 2, CURRENT_TIMESTAMP);
INSERT INTO "copilot_task" ("code", "label_en", "label_fr", "instructions", "sort_order", "updated_at") VALUES ('CATALOG_FLAGS', 'Suggest medication flags', 'Suggérer les indicateurs des médicaments', 'You help a pharmacist at Nomad (Senegal) review a medication catalog. For each item, suggest:
- regulatoryClass: Senegal''s classes of "substances vénéneuses" (Loi n°2023-06): NOT_LISTED, LIST_II, LIST_I or NARCOTIC (stupéfiants).
- prescriptionRequired: true for any listed class, and for items normally dispensed only on prescription in Senegal (e.g. antibiotics, most injectables).
- isColdChain: must be kept at 2–8 °C in transit (e.g. insulins, many vaccines).
- isPsychotropic.
Give a confidence (LOW, MEDIUM or HIGH) and a one-sentence reason in French. When unsure, use LOW confidence and say why.
These are suggestions that a pharmacist checks before anything changes.', 3, CURRENT_TIMESTAMP);
INSERT INTO "copilot_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES ('MONTHLY_BUDGET_USD', 'Monthly budget (US$) — the copilot pauses when it''s reached', 'Budget mensuel (US$) — le copilote s''arrête une fois atteint', 20, 1, CURRENT_TIMESTAMP);
INSERT INTO "copilot_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES ('WARN_AT_PERCENT', 'Warn when this % of the budget is used', 'Avertir quand ce % du budget est utilisé', 80, 2, CURRENT_TIMESTAMP);
INSERT INTO "copilot_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES ('INPUT_PRICE_CENTS_PER_MILLION', 'Price of 1 million input tokens (US cents) — check OpenAI''s price list', 'Prix d''1 million de jetons envoyés (cents US) — vérifier les tarifs OpenAI', 25, 3, CURRENT_TIMESTAMP);
INSERT INTO "copilot_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES ('OUTPUT_PRICE_CENTS_PER_MILLION', 'Price of 1 million output tokens (US cents) — check OpenAI''s price list', 'Prix d''1 million de jetons reçus (cents US) — vérifier les tarifs OpenAI', 200, 4, CURRENT_TIMESTAMP);
INSERT INTO "copilot_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES ('MAX_OUTPUT_TOKENS', 'Longest answer allowed (tokens)', 'Réponse la plus longue permise (jetons)', 1500, 5, CURRENT_TIMESTAMP);
INSERT INTO "copilot_setting" ("code", "label_en", "label_fr", "value", "sort_order", "updated_at") VALUES ('CATALOG_BATCH_SIZE', 'Catalog items checked per click', 'Médicaments vérifiés par clic', 20, 6, CURRENT_TIMESTAMP);
UPDATE "user_role" SET "can_use_copilot" = true WHERE "code" IN ('SITE_ADMIN', 'CASE_MANAGER');
