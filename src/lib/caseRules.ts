/** First-pass colour for a new request (MVP step 1.2): plain rules, no AI,
 * so every case gets a colour even when the AI is off. Step 1.3 moves the
 * thresholds into admin-editable settings and adds overdue timers; step 1.4
 * lets the copilot add signals on top.
 *
 * RED    — the member said it's life-threatening, or used urgent words.
 * YELLOW — needs attention: help wanted today, urgent-care category, or no
 *          location to find providers near them.
 * GREEN  — routine request with a location.
 *
 * The urgent-word list is a starting point for Nomad's medical lead to
 * review — it errs toward RED, which only means a person looks sooner. */

export type RuleInput = {
  urgency: "EMERGENCY" | "TODAY" | "THIS_WEEK" | "ROUTINE";
  categoryCode: string;
  description: string;
  hasLocation: boolean;
};

export type Rag = "GREEN" | "YELLOW" | "RED";

/** Reason codes, translated for display (Cases.ragReason.*). */
export type RagReason = "MEMBER_SAID_EMERGENCY" | "URGENT_WORDS" | "WANTED_TODAY" | "URGENT_CARE_CATEGORY" | "NO_LOCATION";

// Matched on accent-stripped, lower-cased text, as whole words or phrases.
const URGENT_PHRASES = [
  // English
  "chest pain", "can't breathe", "cannot breathe", "not breathing", "difficulty breathing", "unconscious", "unresponsive",
  "fainted", "seizure", "stroke", "heart attack", "heavy bleeding", "bleeding heavily", "severe bleeding", "overdose",
  "poisoning", "suicide", "suicidal", "severe burn", "car accident", "head injury", "choking", "anaphylaxis", "allergic reaction",
  "labour", "labor", "miscarriage", "high fever baby", "paralysis",
  // French
  "douleur thoracique", "douleur a la poitrine", "mal a la poitrine", "ne respire plus", "ne respire pas", "difficulte a respirer",
  "du mal a respirer", "inconscient", "inconsciente", "evanoui", "evanouie", "convulsion", "convulsions", "crise d'epilepsie", "avc",
  "crise cardiaque", "infarctus", "saignement abondant", "hemorragie", "saigne beaucoup", "overdose", "intoxication",
  "empoisonnement", "suicide", "suicidaire", "brulure grave", "accident de voiture", "accident de la route", "traumatisme cranien",
  "etouffe", "etouffement", "choc anaphylactique", "reaction allergique", "accouchement", "fausse couche", "paralysie",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'");
}

export function findUrgentPhrases(description: string): string[] {
  const text = ` ${normalize(description).replace(/[^a-z0-9']+/g, " ")} `;
  return URGENT_PHRASES.filter((p) => text.includes(` ${p} `));
}

export function initialRag(input: RuleInput): { rag: Rag; reasons: RagReason[] } {
  const red: RagReason[] = [];
  if (input.urgency === "EMERGENCY") red.push("MEMBER_SAID_EMERGENCY");
  if (findUrgentPhrases(input.description).length > 0) red.push("URGENT_WORDS");
  if (red.length) return { rag: "RED", reasons: red };

  const yellow: RagReason[] = [];
  if (input.urgency === "TODAY") yellow.push("WANTED_TODAY");
  if (input.categoryCode === "URGENT_CARE") yellow.push("URGENT_CARE_CATEGORY");
  if (!input.hasLocation) yellow.push("NO_LOCATION");
  if (yellow.length) return { rag: "YELLOW", reasons: yellow };

  return { rag: "GREEN", reasons: [] };
}
