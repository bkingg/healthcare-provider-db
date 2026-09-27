/**
 * Demo cases for manually testing the case management system (MVP step 1.3):
 * 20 member requests covering the scenarios staff will meet — fresh and
 * overdue red emergencies, cases that escalate when the dashboard is opened,
 * member replies waiting for an answer, a staff colour override, cases
 * waiting on the member, resolved and closed cases, WhatsApp / no WhatsApp,
 * an English-speaking member, an out-of-hours arrival and a Google Maps link.
 *
 *   npm run db:seed-demo-cases
 *
 * Re-running resets them: it deletes only the cases it created before
 * (marked {"demo": true} on their "created" timeline event) and builds them
 * again relative to the current time — cases members or staff created by
 * hand are never touched. Also creates a few more demo members and a demo
 * Case Manager login (casemanager.demo@local.dev / CaseManager-demo-1!).
 * Refuses to run against a production build.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type CaseEventType, type CaseStatus } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { initialRag, type Rag } from "../src/lib/caseRules";
import { responseDueAt } from "../src/lib/businessHours";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to create demo cases in production.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const now = new Date();
const MIN = 60_000;
const ago = (minutes: number) => new Date(now.getTime() - minutes * MIN);
/** A calendar day `days` before today at hh:mm Dakar time (= UTC). */
const daysAgoAt = (days: number, hh: number, mm = 0) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, hh, mm));

type Who = "admin" | "cm" | "system" | "member";
type EventSpec = { at: Date; type: CaseEventType; who: Who; body?: string; data?: Record<string, unknown>; visible?: boolean };
type CaseSpec = {
  requester: string;
  patient: string;
  category: string;
  urgency: "EMERGENCY" | "TODAY" | "THIS_WEEK" | "ROUTINE";
  description: string;
  phone: string;
  whatsapp: boolean;
  location?: { label?: string; lat?: number; lng?: number };
  createdAt: Date;
  status: CaseStatus;
  assignedTo?: "admin" | "cm";
  /** "created": timer from arrival; "reply": from the member's last reply;
   * "overdue": already past due (escalates when the dashboard opens);
   * "none": staff have responded or the case waits on the member. */
  due: "created" | "reply" | "overdue" | "none";
  override?: { to: Rag; reason: string; at: Date; who: "admin" | "cm" };
  shortlist?: { count: number; chosen?: number; at: Date; who: "admin" | "cm" };
  events?: EventSpec[];
  /** Leave unset to show "new message" in the member app. */
  memberSeenAt?: Date;
};

async function main() {
  // ------------------------------------------------------------ people
  const senegal = await prisma.countryRef.findUniqueOrThrow({ where: { iso2: "SN" } });
  const spouse = await prisma.memberRelationshipRef.findUniqueOrThrow({ where: { code: "SPOUSE" } });
  const demoEmployer = await prisma.organizationRef.findUnique({ where: { code: "DEMO-EMPLOYER" } });

  async function demoMember(email: string, data: Record<string, unknown>) {
    return prisma.member.upsert({ where: { email }, update: {}, create: { email, preferredLanguage: "fr", countryId: senegal.id, ...data } as never });
  }
  const ibrahima = await demoMember("ibrahima.diallo.demo@example.com", {
    firstName: "Ibrahima", lastName: "Diallo", dateOfBirth: new Date("1978-02-14"), sex: "MALE", phone: "+221 77 640 12 34", city: "Thiès",
    organizationId: demoEmployer?.id ?? null, planName: "Standard", policyNumber: "DEMO-0002",
  });
  await demoMember("aminata.diallo.demo@example.com", {
    firstName: "Aminata", lastName: "Diallo", dateOfBirth: new Date("1982-07-30"), sex: "FEMALE", phone: "+221 76 211 45 67", city: "Thiès",
    primaryMemberId: ibrahima.id, relationshipId: spouse.id, organizationId: demoEmployer?.id ?? null, planName: "Standard", policyNumber: "DEMO-0002",
  });
  await demoMember("khady.sarr.demo@example.com", {
    firstName: "Khady", lastName: "Sarr", dateOfBirth: new Date("1993-11-05"), sex: "FEMALE", phone: "+221 70 455 88 19", city: "Rufisque",
  });

  const members = await prisma.member.findMany({ where: { OR: [{ email: { endsWith: ".demo@example.com" } }, { firstName: "Fatou", lastName: "Ndiaye" }] } });
  const m = (key: string) => {
    // Demo first names are unique, so the scenarios refer to people by first name.
    const found = members.find((x) => x.firstName.toLowerCase() === key);
    if (!found) throw new Error(`Demo member "${key}" not found — run npm run db:seed-demo first.`);
    return found;
  };

  const admin =
    (await prisma.user.findUnique({ where: { email: "superadmin@local.dev" } })) ?? (await prisma.user.findUniqueOrThrow({ where: { email: "system@seed.local" } }));
  const caseManagerRole = await prisma.userRole.findUniqueOrThrow({ where: { code: "CASE_MANAGER" } });
  const cm = await prisma.user.upsert({
    where: { email: "casemanager.demo@local.dev" },
    update: {},
    create: {
      email: "casemanager.demo@local.dev", name: "Mariama Case Manager (demo)", handle: "casemanager.demo", roleId: caseManagerRole.id,
      passwordHash: await bcrypt.hash("CaseManager-demo-1!", 12), mustChangePassword: false,
    },
  });
  const staffId = (who: "admin" | "cm") => (who === "admin" ? admin.id : cm.id);

  const targets = new Map((await prisma.caseResponseTarget.findMany()).map((t) => [t.code as Rag, t]));
  const due = (rag: Rag, from: Date) => {
    const t = targets.get(rag);
    return t ? responseDueAt(from, t.minutes, t.businessHoursOnly) : null;
  };
  const categories = new Map((await prisma.caseCategoryRef.findMany()).map((c) => [c.code, c]));

  // Providers near a point, nearest first — the same "active only, never
  // DO NOT USE" rule as the app's "Find providers".
  const withCoords = await prisma.provider.findMany({
    where: { status: "ACTIVE", addresses: { some: { latitude: { not: null } } } },
    include: { addresses: { where: { latitude: { not: null } }, take: 1 } },
  });
  const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const r = (d: number) => (d * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  };

  // ----------------------------------------------------- reset old demo cases
  const removed = await prisma.careCase.deleteMany({ where: { events: { some: { type: "CREATED", data: { path: ["demo"], equals: true } } } } });

  // ------------------------------------------------------------- scenarios
  const specs: CaseSpec[] = [
    {
      // 1. Fresh red emergency, unassigned, clock running (15 min, 24/7).
      requester: "awa", patient: "awa", category: "URGENT_CARE", urgency: "EMERGENCY", phone: "+221 77 555 01 01", whatsapp: true,
      description: "Douleur thoracique forte depuis 20 minutes, je transpire beaucoup et j'ai du mal à respirer.",
      location: { label: "Dakar, Plateau", lat: 14.6694, lng: -17.4376 }, createdAt: ago(4), status: "NEW", due: "created",
    },
    {
      // 2. Red emergency already overdue — nobody picked it up.
      requester: "ibrahima", patient: "aminata", category: "URGENT_CARE", urgency: "EMERGENCY", phone: "+221 77 640 12 34", whatsapp: true,
      description: "Ma femme a fait un malaise, elle est inconsciente par moments. Nous sommes à la maison.",
      location: { label: "Thiès, quartier Randoulène" }, createdAt: ago(40), status: "NEW", due: "created",
    },
    {
      // 3. Member chose "not urgent" but used urgent words → red by the rules.
      requester: "awa", patient: "fatou", category: "FIND_DOCTOR", urgency: "ROUTINE", phone: "+221 77 555 01 01", whatsapp: false,
      description: "Fatou a eu une convulsion hier soir, elle va mieux mais nous voulons voir un neurologue rapidement.",
      location: { label: "Almadies, Dakar", lat: 14.744, lng: -17.516 }, createdAt: ago(120), status: "IN_PROGRESS", assignedTo: "admin", due: "none",
      events: [
        { at: ago(115), type: "ASSIGNED", who: "admin", data: { from: null, to: "admin" } },
        { at: ago(110), type: "MESSAGE_TO_MEMBER", who: "admin", visible: true, body: "Bonjour Awa, nous vous appelons dans 5 minutes pour parler de Fatou. En cas de nouvelle convulsion, appelez le SAMU au 1515." },
        { at: ago(110), type: "STATUS_CHANGED", who: "admin", data: { from: "NEW", to: "IN_PROGRESS" } },
      ],
    },
    {
      // 4. Yellow, overdue since Thursday → escalates to RED when the dashboard opens.
      requester: "jean", patient: "jean", category: "MEDICATION", urgency: "TODAY", phone: "+221 78 300 22 10", whatsapp: false,
      description: "I ran out of my blood pressure medication (amlodipine 5 mg). I need a new prescription today.",
      location: { label: "Saint-Louis" }, createdAt: daysAgoAt(2, 14), status: "NEW", due: "overdue",
    },
    {
      // 5. Green, overdue since Wednesday → escalates to YELLOW when the dashboard opens.
      requester: "khady", patient: "khady", category: "BOOK_APPOINTMENT", urgency: "ROUTINE", phone: "+221 70 455 88 19", whatsapp: true,
      description: "Je voudrais un rendez-vous chez un gynécologue pour un suivi de routine.",
      location: { label: "Rufisque" }, createdAt: daysAgoAt(3, 10), status: "NEW", due: "overdue",
    },
    {
      // 6. Yellow, member replied — staff owe an answer.
      requester: "ibrahima", patient: "ibrahima", category: "URGENT_CARE", urgency: "TODAY", phone: "+221 77 640 12 34", whatsapp: true,
      description: "Forte fièvre (39,5) depuis ce matin avec des courbatures.",
      location: { label: "Thiès" }, createdAt: ago(180), status: "IN_PROGRESS", assignedTo: "cm", due: "reply",
      events: [
        { at: ago(170), type: "ASSIGNED", who: "cm", data: { from: null, to: "cm" } },
        { at: ago(150), type: "MESSAGE_TO_MEMBER", who: "cm", visible: true, body: "Bonjour Ibrahima, avez-vous pris du paracétamol ? Avez-vous voyagé ces dernières semaines ?" },
        { at: ago(150), type: "STATUS_CHANGED", who: "cm", data: { from: "NEW", to: "IN_PROGRESS" } },
        { at: ago(20), type: "MESSAGE_FROM_MEMBER", who: "member", visible: true, body: "Oui, paracétamol à 8h. Pas de voyage. La fièvre ne baisse pas." },
      ],
      memberSeenAt: ago(20),
    },
    {
      // 7. Yellow only because there's no location.
      requester: "moussa", patient: "moussa", category: "FIND_DOCTOR", urgency: "THIS_WEEK", phone: "+221 77 812 33 44", whatsapp: true,
      description: "Douleurs au genou depuis une chute au football, je cherche un orthopédiste.",
      createdAt: ago(50), status: "NEW", due: "created",
    },
    {
      // 8. Green with a provider shortlist, one chosen, waiting on the member (unread message).
      requester: "awa", patient: "awa", category: "FIND_DOCTOR", urgency: "ROUTINE", phone: "+221 77 555 01 01", whatsapp: true,
      description: "Je cherche un dermatologue pour des taches sur la peau apparues ce mois-ci.",
      location: { label: "Dakar", lat: 14.6928, lng: -17.4467 }, createdAt: ago(300), status: "WAITING_MEMBER", assignedTo: "admin", due: "none",
      shortlist: { count: 5, chosen: 1, at: ago(280), who: "admin" },
      events: [
        { at: ago(285), type: "ASSIGNED", who: "admin", data: { from: null, to: "admin" } },
        { at: ago(260), type: "NOTE", who: "admin", body: "Clinique appelée : rendez-vous possible mardi 10h avec la dermatologue." },
        { at: ago(255), type: "MESSAGE_TO_MEMBER", who: "admin", visible: true, body: "Bonjour Awa, nous pouvons vous proposer un rendez-vous mardi à 10h chez une dermatologue près de chez vous. Cela vous convient-il ?" },
        { at: ago(255), type: "STATUS_CHANGED", who: "admin", data: { from: "NEW", to: "WAITING_MEMBER" } },
      ],
    },
    {
      // 9. Green, new, typed location, for a child.
      requester: "awa", patient: "fatou", category: "BOOK_APPOINTMENT", urgency: "THIS_WEEK", phone: "+221 77 555 01 01", whatsapp: true,
      description: "Visite de contrôle et vaccins de rappel pour Fatou.",
      location: { label: "Almadies, Dakar" }, createdAt: ago(30), status: "NEW", due: "created",
    },
    {
      // 10. Green, English, waiting on the member for documents (unread message).
      requester: "jean", patient: "jean", category: "SECOND_OPINION", urgency: "ROUTINE", phone: "+221 78 300 22 10", whatsapp: false,
      description: "I was told I need knee surgery. I'd like a second opinion before deciding.",
      location: { label: "Saint-Louis" }, createdAt: daysAgoAt(4, 9, 30), status: "WAITING_MEMBER", assignedTo: "cm", due: "none",
      events: [
        { at: daysAgoAt(4, 10), type: "ASSIGNED", who: "cm", data: { from: null, to: "cm" } },
        { at: daysAgoAt(4, 11), type: "MESSAGE_TO_MEMBER", who: "cm", visible: true, body: "Hello Jean, could you send us the surgeon's report and your MRI results? You can reply here with a link or a short summary." },
        { at: daysAgoAt(4, 11), type: "STATUS_CHANGED", who: "cm", data: { from: "NEW", to: "WAITING_MEMBER" } },
      ],
    },
    {
      // 11. Green billing question, resolved.
      requester: "khady", patient: "khady", category: "BILLING", urgency: "ROUTINE", phone: "+221 70 455 88 19", whatsapp: true,
      description: "La clinique me demande de payer 25 000 FCFA pour une consultation, est-ce couvert ?",
      location: { label: "Rufisque" }, createdAt: daysAgoAt(5, 10), status: "RESOLVED", assignedTo: "admin", due: "none",
      events: [
        { at: daysAgoAt(5, 11), type: "MESSAGE_TO_MEMBER", who: "admin", visible: true, body: "Bonjour Khady, en tant que membre individuelle, cette consultation n'est pas prise en charge directement. Nous pouvons vous orienter vers une clinique du réseau à tarif négocié." },
        { at: daysAgoAt(5, 11), type: "STATUS_CHANGED", who: "admin", data: { from: "NEW", to: "IN_PROGRESS" } },
        { at: daysAgoAt(5, 12), type: "MESSAGE_FROM_MEMBER", who: "member", visible: true, body: "D'accord, merci pour l'explication." },
        { at: daysAgoAt(5, 13), type: "STATUS_CHANGED", who: "admin", data: { from: "IN_PROGRESS", to: "RESOLVED" } },
      ],
      memberSeenAt: daysAgoAt(5, 12),
    },
    {
      // 12. Green medication refill, closed last week.
      requester: "moussa", patient: "moussa", category: "MEDICATION", urgency: "ROUTINE", phone: "+221 77 812 33 44", whatsapp: false,
      description: "Renouvellement d'ordonnance pour l'asthme (Ventoline).",
      location: { label: "Dakar, Mermoz" }, createdAt: daysAgoAt(8, 9), status: "CLOSED", assignedTo: "cm", due: "none",
      events: [
        { at: daysAgoAt(8, 10), type: "MESSAGE_TO_MEMBER", who: "cm", visible: true, body: "Bonjour Moussa, votre ordonnance est prête à la pharmacie du Plateau." },
        { at: daysAgoAt(8, 10), type: "STATUS_CHANGED", who: "cm", data: { from: "NEW", to: "IN_PROGRESS" } },
        { at: daysAgoAt(7, 9), type: "STATUS_CHANGED", who: "cm", data: { from: "IN_PROGRESS", to: "CLOSED" } },
      ],
      memberSeenAt: daysAgoAt(8, 12),
    },
    {
      // 13. Yellow by the rules, overridden to green by staff (with reason).
      requester: "aminata", patient: "aminata", category: "URGENT_CARE", urgency: "TODAY", phone: "+221 76 211 45 67", whatsapp: true,
      description: "Mal de dents depuis deux jours, la joue commence à gonfler.",
      location: { label: "Thiès" }, createdAt: ago(90), status: "IN_PROGRESS", assignedTo: "cm", due: "none",
      override: { to: "GREEN", reason: "Appelée : douleur modérée, pas de fièvre. Rendez-vous chez le dentiste lundi 9h confirmé.", at: ago(60), who: "cm" },
      events: [
        { at: ago(70), type: "ASSIGNED", who: "cm", data: { from: null, to: "cm" } },
        { at: ago(55), type: "MESSAGE_TO_MEMBER", who: "cm", visible: true, body: "Bonjour Aminata, votre rendez-vous chez le dentiste est confirmé lundi à 9h. Si la joue gonfle davantage ou si vous avez de la fièvre, écrivez-nous." },
        { at: ago(55), type: "STATUS_CHANGED", who: "cm", data: { from: "NEW", to: "IN_PROGRESS" } },
      ],
      memberSeenAt: ago(50),
    },
    {
      // 14. Red emergency handled two days ago, resolved (history example).
      requester: "khady", patient: "khady", category: "URGENT_CARE", urgency: "EMERGENCY", phone: "+221 70 455 88 19", whatsapp: true,
      description: "Accident de la route, je saigne beaucoup au bras.",
      location: { label: "Rufisque", lat: 14.7167, lng: -17.2667 }, createdAt: daysAgoAt(2, 19, 40), status: "RESOLVED", assignedTo: "admin", due: "none",
      events: [
        { at: daysAgoAt(2, 19, 45), type: "MESSAGE_TO_MEMBER", who: "admin", visible: true, body: "Khady, avez-vous appelé le SAMU (1515) ? Appuyez fort sur la plaie avec un linge propre." },
        { at: daysAgoAt(2, 19, 45), type: "STATUS_CHANGED", who: "admin", data: { from: "NEW", to: "IN_PROGRESS" } },
        { at: daysAgoAt(2, 19, 52), type: "MESSAGE_FROM_MEMBER", who: "member", visible: true, body: "Oui, ils m'emmènent à l'hôpital de Rufisque." },
        { at: daysAgoAt(1, 10), type: "NOTE", who: "admin", body: "Suivi : points de suture à l'hôpital de Rufisque, pas d'autre besoin. Rappeler dans une semaine pour les fils." },
        { at: daysAgoAt(1, 10, 5), type: "STATUS_CHANGED", who: "admin", data: { from: "IN_PROGRESS", to: "RESOLVED" } },
      ],
      memberSeenAt: daysAgoAt(1, 12),
    },
    {
      // 15. Member reply containing a Google Maps link; staff owe an answer.
      requester: "awa", patient: "moussa", category: "FIND_DOCTOR", urgency: "THIS_WEEK", phone: "+221 77 555 01 01", whatsapp: true,
      description: "Moussa a besoin d'un kinésithérapeute près de chez nous après son opération.",
      location: { label: "Ouakam" }, createdAt: daysAgoAt(1, 11), status: "IN_PROGRESS", assignedTo: "admin", due: "reply",
      events: [
        { at: daysAgoAt(1, 11, 30), type: "MESSAGE_TO_MEMBER", who: "admin", visible: true, body: "Bonjour Awa, pouvez-vous nous envoyer votre adresse exacte pour trouver le cabinet le plus proche ?" },
        { at: daysAgoAt(1, 11, 30), type: "STATUS_CHANGED", who: "admin", data: { from: "NEW", to: "IN_PROGRESS" } },
        { at: ago(45), type: "MESSAGE_FROM_MEMBER", who: "member", visible: true, body: "Voici notre adresse : https://maps.app.goo.gl/q7yXhZ3Kp2Lm9Rt8A (maison bleue en face de la mosquée)." },
      ],
      memberSeenAt: ago(45),
    },
    {
      // 16. Arrived out of office hours (Saturday morning) — due Monday.
      requester: "jean", patient: "jean", category: "FIND_DOCTOR", urgency: "THIS_WEEK", phone: "+221 78 300 22 10", whatsapp: false,
      description: "Looking for an English-speaking general practitioner for a check-up.",
      location: { label: "Dakar, Plateau" }, createdAt: daysAgoAt(0, 7, 30) < now ? daysAgoAt(0, 7, 30) : ago(60), status: "NEW", due: "created",
    },
    {
      // 17. Red by urgent words, very fresh, unassigned.
      requester: "ibrahima", patient: "ibrahima", category: "OTHER", urgency: "TODAY", phone: "+221 77 640 12 34", whatsapp: true,
      description: "Difficulté à respirer depuis une heure, je suis asthmatique et mon inhalateur ne suffit pas.",
      location: { label: "Thiès" }, createdAt: ago(10), status: "NEW", due: "created",
    },
    {
      // 18. Green, assigned with only an internal note — a note doesn't stop the clock.
      requester: "moussa", patient: "moussa", category: "SECOND_OPINION", urgency: "ROUTINE", phone: "+221 77 812 33 44", whatsapp: true,
      description: "Je voudrais un deuxième avis sur mon traitement contre le cholestérol.",
      location: { label: "Dakar, Mermoz", lat: 14.707, lng: -17.479 }, createdAt: daysAgoAt(1, 10), status: "NEW", assignedTo: "cm", due: "created",
      events: [
        { at: daysAgoAt(1, 10, 20), type: "ASSIGNED", who: "cm", data: { from: null, to: "cm" } },
        { at: daysAgoAt(1, 10, 25), type: "NOTE", who: "cm", body: "Lui demander ses dernières analyses de sang avant d'appeler un cardiologue." },
      ],
    },
    {
      // 19. Yellow, waiting on the member (clock stopped).
      requester: "ibrahima", patient: "aminata", category: "MEDICATION", urgency: "TODAY", phone: "+221 77 640 12 34", whatsapp: true,
      description: "Aminata a besoin d'insuline, sa pharmacie habituelle est en rupture.",
      location: { label: "Thiès" }, createdAt: ago(240), status: "WAITING_MEMBER", assignedTo: "admin", due: "none",
      events: [
        { at: ago(225), type: "MESSAGE_TO_MEMBER", who: "admin", visible: true, body: "Bonjour Ibrahima, quelle insuline exactement (nom et dosage) ? Nous cherchons une pharmacie qui l'a en stock à Thiès." },
        { at: ago(225), type: "STATUS_CHANGED", who: "admin", data: { from: "NEW", to: "WAITING_MEMBER" } },
      ],
    },
    {
      // 20. Green, new, English, no WhatsApp.
      requester: "jean", patient: "jean", category: "BILLING", urgency: "ROUTINE", phone: "+221 78 300 22 10", whatsapp: false,
      description: "Can I get a copy of my coverage certificate for my employer?",
      location: { label: "Saint-Louis" }, createdAt: ago(15), status: "NEW", due: "created",
    },
  ];

  // ------------------------------------------------------------- create
  const who = (w: Who, member: { id: string }) =>
    w === "member" ? { actorType: "MEMBER" as const, memberId: member.id } : w === "system" ? { actorType: "SYSTEM" as const } : { actorType: "STAFF" as const, staffId: staffId(w) };

  const created: { n: number; rag: string; status: string }[] = [];
  for (const s of specs) {
    const requester = m(s.requester);
    const patient = m(s.patient);
    const category = categories.get(s.category)!;
    const hasLocation = Boolean(s.location?.label) || s.location?.lat !== undefined;
    const rules = initialRag({ urgency: s.urgency, categoryCode: category.code, description: s.description, hasLocation });
    const rag = s.override?.to ?? rules.rag;
    const reasons = s.override ? ["STAFF_OVERRIDE"] : rules.reasons;
    const lastReply = [...(s.events ?? [])].reverse().find((e) => e.type === "MESSAGE_FROM_MEMBER")?.at;
    let responseDue: Date | null =
      s.due === "none" ? null : s.due === "reply" ? due(rag, lastReply ?? s.createdAt) : due(rules.rag, s.createdAt);
    if (s.due === "overdue" && responseDue && responseDue > ago(30)) responseDue = ago(30);

    const events: EventSpec[] = [
      { at: s.createdAt, type: "CREATED", who: "member", data: { demo: true } } satisfies EventSpec,
      { at: s.createdAt, type: "COLOUR_SET", who: "system", data: { to: rules.rag, reasons: rules.reasons } } satisfies EventSpec,
      ...(s.override ? [{ at: s.override.at, type: "COLOUR_OVERRIDDEN" as const, who: s.override.who, body: s.override.reason, data: { from: rules.rag, to: s.override.to } }] : []),
      ...(s.events ?? []).map((e) => (e.type === "ASSIGNED" ? { ...e, data: { from: null, to: staffId(e.who as "admin" | "cm") } } : e)),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    const lastActivity = events[events.length - 1].at;

    const c = await prisma.careCase.create({
      data: {
        requestedById: requester.id, patientId: patient.id, categoryId: category.id, description: s.description, urgency: s.urgency,
        contactPhone: s.phone, contactHasWhatsapp: s.whatsapp,
        locationLabel: s.location?.label ?? null, latitude: s.location?.lat ?? null, longitude: s.location?.lng ?? null,
        status: s.status, rag, ragReasons: reasons, ragOverridden: Boolean(s.override), responseDueAt: responseDue,
        assignedToId: s.assignedTo ? staffId(s.assignedTo) : null, memberLastSeenAt: s.memberSeenAt ?? null,
        resolvedAt: s.status === "RESOLVED" || s.status === "CLOSED" ? lastActivity : null,
        channel: "MEMBER_APP", createdAt: s.createdAt, updatedAt: lastActivity,
      },
    });
    for (const e of events) {
      await prisma.caseEvent.create({
        data: { caseId: c.id, type: e.type, ...who(e.who, requester), body: e.body ?? null, data: (e.data ?? undefined) as never, visibleToMember: e.visible ?? false, createdAt: e.at },
      });
    }
    if (s.shortlist && s.location?.lat !== undefined && s.location.lng !== undefined) {
      const point = { lat: s.location.lat, lng: s.location.lng };
      const nearest = withCoords
        .map((p) => ({ p, d: km(point, { lat: p.addresses[0].latitude!, lng: p.addresses[0].longitude! }) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, s.shortlist.count);
      for (const [i, { p, d }] of nearest.entries()) {
        await prisma.caseProviderOption.create({
          data: { caseId: c.id, providerId: p.id, rank: i + 1, distanceKm: Math.round(d * 10) / 10, source: "SEARCH", selected: i === s.shortlist.chosen, createdAt: s.shortlist.at },
        });
      }
      await prisma.caseEvent.create({ data: { caseId: c.id, type: "PROVIDERS_FOUND", actorType: "STAFF", staffId: staffId(s.shortlist.who), data: { count: nearest.length, radiusKm: 25, point }, createdAt: s.shortlist.at } });
      if (s.shortlist.chosen !== undefined && nearest[s.shortlist.chosen]) {
        await prisma.caseEvent.create({
          data: { caseId: c.id, type: "PROVIDER_SELECTED", actorType: "STAFF", staffId: staffId(s.shortlist.who), data: { providerId: nearest[s.shortlist.chosen].p.id, selected: true }, createdAt: new Date(s.shortlist.at.getTime() + 2 * MIN) },
        });
      }
    }
    created.push({ n: c.caseNumber, rag, status: s.status });
  }

  const count = (rag: string) => created.filter((c) => c.rag === rag && ["NEW", "IN_PROGRESS", "WAITING_MEMBER"].includes(c.status)).length;
  console.log(`Demo cases: removed ${removed.count} old, created ${created.length} (CAS-${String(created[0].n).padStart(6, "0")} … CAS-${String(created.at(-1)!.n).padStart(6, "0")}).`);
  console.log(`Open by colour before escalation: red ${count("RED")}, yellow ${count("YELLOW")}, green ${count("GREEN")} — 2 overdue cases escalate when the dashboard is opened.`);
  console.log("Staff logins: superadmin@local.dev, and casemanager.demo@local.dev / CaseManager-demo-1! (Case Manager role).");
  console.log("Member logins (member app /fr/m): awa, moussa, jean, ibrahima, aminata, khady — <first>.<last>.demo@example.com.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
