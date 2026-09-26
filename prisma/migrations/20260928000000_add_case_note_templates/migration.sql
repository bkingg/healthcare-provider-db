-- Internal note templates (Admin > Value lists > Note templates): e.g.
-- phone conversation with member, communication to/from provider. New table
-- only; a note's template is recorded in case_event.data.

-- CreateTable
CREATE TABLE "case_note_template_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_fr" TEXT,
    "body_en" TEXT,
    "body_fr" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_note_template_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_note_template_ref_code_key" ON "case_note_template_ref"("code");

-- Data: starter templates (editable afterwards). Same text as prisma/data/note-templates.ts.
INSERT INTO "case_note_template_ref" ("code", "name_en", "name_fr", "body_en", "body_fr", "sort_order", "updated_at") VALUES
  ($tpl$PHONE_MEMBER$tpl$, $tpl$Phone conversation with member$tpl$, $tpl$Appel téléphonique avec le membre$tpl$, $tpl$## Call details
- Number called:
- Spoke with:
- Duration:

## Reason for the call
-

## What the member told us
-

## Advice or information given
-

## Next steps
- $tpl$, $tpl$## Détails de l'appel
- Numéro appelé :
- Interlocuteur :
- Durée :

## Motif de l'appel
-

## Ce que le membre nous a dit
-

## Conseils ou informations donnés
-

## Prochaines étapes
- $tpl$, 1, CURRENT_TIMESTAMP),
  ($tpl$PROVIDER_OUT$tpl$, $tpl$Communication to provider$tpl$, $tpl$Communication au prestataire$tpl$, $tpl$## Provider contacted
- Provider:
- Contact person:
- Channel (phone, email, WhatsApp):

## Request made
-

## Member information shared (only what's needed)
-

## Provider's answer and availability
-

## Next steps
- $tpl$, $tpl$## Prestataire contacté
- Prestataire :
- Personne contactée :
- Canal (téléphone, e-mail, WhatsApp) :

## Demande faite
-

## Informations du membre partagées (uniquement le nécessaire)
-

## Réponse et disponibilité du prestataire
-

## Prochaines étapes
- $tpl$, 2, CURRENT_TIMESTAMP),
  ($tpl$PROVIDER_IN$tpl$, $tpl$Communication from provider$tpl$, $tpl$Communication du prestataire$tpl$, $tpl$## Provider
- Provider:
- Contact person:
- Channel (phone, email, WhatsApp):

## What the provider told us
-

## Appointment, costs or documents
-

## Action needed
- $tpl$, $tpl$## Prestataire
- Prestataire :
- Personne de contact :
- Canal (téléphone, e-mail, WhatsApp) :

## Ce que le prestataire nous a dit
-

## Rendez-vous, coûts ou documents
-

## Action nécessaire
- $tpl$, 3, CURRENT_TIMESTAMP),
  ($tpl$CASE_REVIEW$tpl$, $tpl$Case review$tpl$, $tpl$Revue du dossier$tpl$, $tpl$## Case summary
-

## Actions taken so far
-

## Current status
- Member contacted:
- Provider involved:

## Open issues or risks
-

## Decision (continue, escalate or close)
-

## Next review date
- $tpl$, $tpl$## Résumé du dossier
-

## Actions menées jusqu'ici
-

## Situation actuelle
- Membre contacté :
- Prestataire concerné :

## Points ouverts ou risques
-

## Décision (poursuivre, escalader ou clôturer)
-

## Date de la prochaine revue
- $tpl$, 4, CURRENT_TIMESTAMP),
  ($tpl$CLINICAL_REVIEW$tpl$, $tpl$Clinical review$tpl$, $tpl$Revue clinique$tpl$, $tpl$## Reviewer
- Name and role:

## Presenting problem
-

## Relevant history (conditions, medications, allergies)
-

## Assessment
- Urgency:
- Appropriate level of care (pharmacy, GP, specialist, emergency):

## Recommendation
-

## Follow-up and safety-net advice given to the member
- $tpl$, $tpl$## Relecteur
- Nom et fonction :

## Motif de consultation
-

## Antécédents utiles (pathologies, traitements, allergies)
-

## Évaluation
- Urgence :
- Niveau de soins adapté (pharmacie, généraliste, spécialiste, urgences) :

## Recommandation
-

## Suivi et consignes de sécurité donnés au membre
- $tpl$, 5, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
