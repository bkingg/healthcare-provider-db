/** Starter note templates (MVP): inserted by migration
 * 20260928000000_add_case_note_templates and upserted by the seed. After
 * that they're Nomad's to edit in Admin > Value lists > Note templates.
 * "## " lines show as headings and "- " lines as bullet points. */
export const NOTE_TEMPLATES = [
  {
    code: "PHONE_MEMBER",
    nameEn: "Phone conversation with member",
    nameFr: "Appel téléphonique avec le membre",
    sortOrder: 1,
    bodyEn: `## Call details
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
- `,
    bodyFr: `## Détails de l'appel
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
- `,
  },
  {
    code: "PROVIDER_OUT",
    nameEn: "Communication to provider",
    nameFr: "Communication au prestataire",
    sortOrder: 2,
    bodyEn: `## Provider contacted
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
- `,
    bodyFr: `## Prestataire contacté
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
- `,
  },
  {
    code: "PROVIDER_IN",
    nameEn: "Communication from provider",
    nameFr: "Communication du prestataire",
    sortOrder: 3,
    bodyEn: `## Provider
- Provider:
- Contact person:
- Channel (phone, email, WhatsApp):

## What the provider told us
-

## Appointment, costs or documents
-

## Action needed
- `,
    bodyFr: `## Prestataire
- Prestataire :
- Personne de contact :
- Canal (téléphone, e-mail, WhatsApp) :

## Ce que le prestataire nous a dit
-

## Rendez-vous, coûts ou documents
-

## Action nécessaire
- `,
  },
  {
    code: "CASE_REVIEW",
    nameEn: "Case review",
    nameFr: "Revue du dossier",
    sortOrder: 4,
    bodyEn: `## Case summary
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
- `,
    bodyFr: `## Résumé du dossier
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
- `,
  },
  {
    code: "CLINICAL_REVIEW",
    nameEn: "Clinical review",
    nameFr: "Revue clinique",
    sortOrder: 5,
    bodyEn: `## Reviewer
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
- `,
    bodyFr: `## Relecteur
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
- `,
  },
] as const;
