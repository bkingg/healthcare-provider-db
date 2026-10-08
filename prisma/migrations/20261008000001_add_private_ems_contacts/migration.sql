-- Private 24/7 ambulance services shown in the member app (Admin > Value
-- lists > Emergency contacts). Numbers from each provider's own website,
-- checked 2026-10-08: sosmedecinsenegal.com and urgsolutionsmed.sn.
INSERT INTO "emergency_contact_ref" ("code", "label_en", "label_fr", "phone", "kind", "country_id", "sort_order", "updated_at")
SELECT v.code, v.label_en, v.label_fr, v.phone, 'PRIVATE_EMS', c.id, v.sort_order, CURRENT_TIMESTAMP
FROM (VALUES
  ('SN_SOS_MEDECINS', 'SOS Médecins Sénégal', 'SOS Médecins Sénégal', '+221 33 889 15 15', 10),
  ('SN_USM', 'Urgences et Solutions Médicales (USM)', 'Urgences et Solutions Médicales (USM)', '+221 33 869 98 97', 11)
) AS v(code, label_en, label_fr, phone, sort_order)
CROSS JOIN (SELECT id FROM "country_ref" WHERE iso2 = 'SN' LIMIT 1) c
ON CONFLICT ("code") DO NOTHING;
