-- "Today" delivery: when it arrives, by payment time (only if no help text
-- has been written in Admin yet).
UPDATE "medication_timeframe_ref"
SET "help_en" = 'Paid before 8 pm: delivered the same day. Paid after 8 pm: delivered the next day by 11 am.',
    "help_fr" = 'Payée avant 20 h : livrée le jour même. Payée après 20 h : livrée le lendemain avant 11 h.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'TODAY' AND "help_en" IS NULL AND "help_fr" IS NULL;
