import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aiProvider, askAi, AiUnavailableError } from "@/lib/ai";
import { Redactor } from "@/lib/deidentify";
import { formatDakarDateTime } from "@/lib/formatDate";
import { ageFromDateOfBirth, formatMemberNumber } from "@/lib/memberNumber";
import { formatCaseNumber } from "@/lib/caseNumber";
import { addInternalNote, listCaseWorkers } from "./caseOps";
import type { CopilotOutcome, MedicationRegulatoryClass, User, UserRole } from "../../generated/prisma/client";

/** The light AI copilot: three buttons, each reviewed by a person before
 * anything happens — a reply draft staff edit and send themselves, a case
 * summary they read (or keep as an internal note), and catalog flag
 * suggestions someone who edits the catalog applies or dismisses.
 *
 * Every use is logged (who, what, cost, what was done with it — never the
 * text). A monthly budget pauses the copilot once it's spent. */

export type CopilotTask = "REPLY_DRAFT" | "CASE_SUMMARY" | "CATALOG_FLAGS";

type Actor = User & { role: UserRole | null };

const SETTING_DEFAULTS = {
  MONTHLY_BUDGET_USD: 20,
  WARN_AT_PERCENT: 80,
  INPUT_PRICE_CENTS_PER_MILLION: 25,
  OUTPUT_PRICE_CENTS_PER_MILLION: 200,
  MAX_OUTPUT_TOKENS: 1500,
  CATALOG_BATCH_SIZE: 20,
};
type CopilotSettings = Record<keyof typeof SETTING_DEFAULTS, number>;

export async function copilotSettings(): Promise<CopilotSettings> {
  const rows = await prisma.copilotSetting.findMany({ where: { isActive: true } });
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.code in out) out[r.code as keyof CopilotSettings] = r.value;
  return out;
}

/** May this person use the copilot (and is it switched on at all)? */
export function canUseCopilot(actor: Actor): boolean {
  return aiProvider() !== "off" && Boolean(actor.role?.isActive && actor.role.canUseCopilot);
}

export function requireCopilot(actor: Actor) {
  if (!canUseCopilot(actor)) throw new Error("Not authorized to use the copilot");
}

/** Which buttons are on (Admin > Value lists > AI copilot). */
export async function enabledTasks(): Promise<Record<CopilotTask, boolean>> {
  const rows = await prisma.copilotTaskSetting.findMany({ where: { isActive: true } });
  const on = (c: CopilotTask) => rows.some((r) => r.code === c && r.enabled);
  return { REPLY_DRAFT: on("REPLY_DRAFT"), CASE_SUMMARY: on("CASE_SUMMARY"), CATALOG_FLAGS: on("CATALOG_FLAGS") };
}

const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export type BudgetState = { spentUsd: number; budgetUsd: number; percent: number; warn: boolean; paused: boolean };

/** This calendar month's spending against the budget (Dakar time = UTC). */
export async function budgetState(s?: CopilotSettings): Promise<BudgetState> {
  const settings = s ?? (await copilotSettings());
  const agg = await prisma.copilotUsage.aggregate({ where: { createdAt: { gte: monthStart() } }, _sum: { costMicroUsd: true } });
  const spentUsd = (agg._sum.costMicroUsd ?? 0) / 1_000_000;
  const budgetUsd = settings.MONTHLY_BUDGET_USD;
  const percent = budgetUsd > 0 ? Math.round((spentUsd / budgetUsd) * 1000) / 10 : 100;
  return { spentUsd, budgetUsd, percent, warn: percent >= settings.WARN_AT_PERCENT, paused: spentUsd >= budgetUsd };
}

/** Millionths of a dollar: tokens × (cents per million) ÷ 100 × 1e6 ÷ 1e6. */
export function costMicroUsd(inputTokens: number, outputTokens: number, s: Pick<CopilotSettings, "INPUT_PRICE_CENTS_PER_MILLION" | "OUTPUT_PRICE_CENTS_PER_MILLION">): number {
  return Math.round((inputTokens * s.INPUT_PRICE_CENTS_PER_MILLION + outputTokens * s.OUTPUT_PRICE_CENTS_PER_MILLION) / 100);
}

/** Why a button didn't run — shown to staff as is. */
export class CopilotBlockedError extends Error {
  constructor(public reason: "off" | "taskOff" | "budget" | "failed") {
    super(reason);
  }
}

type Run = { instructions?: string; input: string; json?: { name: string; schema: Record<string, unknown> }; mock: () => string };

/** Runs one task: checks it's on and within budget, asks the AI, logs it. */
async function run(task: CopilotTask, actor: Actor, caseId: string | null, build: Run) {
  requireCopilot(actor);
  const [settings, taskRow] = await Promise.all([copilotSettings(), prisma.copilotTaskSetting.findUnique({ where: { code: task } })]);
  const base = { task, userId: actor.id, caseId, provider: aiProvider(), model: "" };
  if (!taskRow?.enabled || !taskRow.isActive) {
    await prisma.copilotUsage.create({ data: { ...base, outcome: "BLOCKED", error: "task switched off" } });
    throw new CopilotBlockedError("taskOff");
  }
  const budget = await budgetState(settings);
  if (budget.paused) {
    await prisma.copilotUsage.create({ data: { ...base, outcome: "BLOCKED", error: "monthly budget reached" } });
    throw new CopilotBlockedError("budget");
  }
  try {
    const answer = await askAi({ instructions: taskRow.instructions, input: build.input, maxOutputTokens: settings.MAX_OUTPUT_TOKENS, json: build.json, mock: build.mock });
    const usage = await prisma.copilotUsage.create({
      data: {
        ...base,
        provider: answer.provider,
        model: answer.model,
        inputTokens: answer.inputTokens,
        outputTokens: answer.outputTokens,
        costMicroUsd: costMicroUsd(answer.inputTokens, answer.outputTokens, settings),
        estimated: answer.estimated,
      },
    });
    return { usage, answer, budget: await budgetState(settings), test: answer.provider === "mock" };
  } catch (err) {
    if (err instanceof AiUnavailableError) throw new CopilotBlockedError("off");
    // The error, never the text sent.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[copilot] ${task} failed:`, message);
    await prisma.copilotUsage.create({ data: { ...base, outcome: "FAILED", error: message.slice(0, 300) } });
    throw new CopilotBlockedError("failed");
  }
}

const hashDraft = (s: string) => crypto.createHash("sha256").update(s.replace(/\s+/g, " ").trim()).digest("hex");
const languageName = (l: string) => (l === "en" ? "English" : "French");

// ------------------------------------------------------------ case context

/** The case as text for the AI, with personal details replaced. */
async function caseContext(caseId: string, staffLocale: string, opts: { notes: boolean }) {
  const [c, workers] = await Promise.all([
    prisma.careCase.findUniqueOrThrow({
      where: { id: caseId },
      include: {
        category: true,
        patient: true,
        requestedBy: true,
        events: { orderBy: { createdAt: "asc" }, select: { type: true, body: true, createdAt: true, data: true, actorType: true } },
        medicationOrder: { include: { lines: { orderBy: { sortOrder: "asc" } }, deliveries: { orderBy: { createdAt: "desc" }, take: 1 } } },
      },
    }),
    listCaseWorkers(),
  ]);
  const r = new Redactor().person("MEMBER", c.requestedBy.firstName, c.requestedBy.lastName).person("PATIENT", c.patient.firstName, c.patient.lastName);
  workers.forEach((w, i) => {
    const [first, ...rest] = (w.name ?? "").split(/\s+/);
    r.person(`STAFF_${i + 1}`, first, rest.join(" "));
  });
  for (const m of [c.requestedBy, c.patient]) {
    r.phone(m.phone).detail("MEMBER_NUMBER", formatMemberNumber(m.memberNumber)).detail("POLICY", m.policyNumber).detail("EMAIL", m.email);
  }
  r.phone(c.contactPhone).detail("ADDRESS", c.locationLabel);
  const o = c.medicationOrder;
  if (o) r.detail("ADDRESS", o.deliveryAddress);

  const when = (d: Date) => formatDakarDateTime(d, "en");
  const age = ageFromDateOfBirth(c.patient.dateOfBirth);
  const lines: string[] = [
    `Staff language: ${languageName(staffLocale)}`,
    `Member's language: ${languageName(c.requestedBy.preferredLanguage)}`,
    `Case ${formatCaseNumber(c.caseNumber)}: ${c.category.nameEn}; status ${c.status}; urgency ${c.urgency}; colour ${c.rag}; opened ${when(c.createdAt)}`,
    `Patient: [PATIENT]${age !== null ? `, ${age} years old` : ""}; asked by ${c.requestedById === c.patientId ? "the patient" : "[MEMBER]"}`,
    `Cover: ${c.patient.isCovered ? "covered member" : "not covered (special request, paid by the member)"}`,
    `Request from the member: ${r.redact(c.description)}`,
  ];
  if (o) {
    const items = o.lines.map((l) => `${l.freeText ? r.redact(l.freeText) : [l.dci, l.strength, l.form].filter(Boolean).join(" ")} × ${l.quantity}`).join("; ");
    lines.push(
      `Medication order: step ${o.status}; items: ${items || "none"}; prescription needed: ${o.needsPrescription ? "yes" : "no"}${o.hasNarcotic ? "; includes a controlled medicine" : ""}`,
      `Prices (FCFA): ${o.totalXof !== null ? `medicines ${o.medicinesXof ?? "?"}, delivery ${o.deliveryXof ?? "?"}, Nomad fee ${o.feeXof ?? "?"}, total ${o.totalXof}` : "not sent yet"}`,
    );
    if (o.promisedBy) lines.push(`Delivery promised by: ${when(o.promisedBy)}`);
    if (o.memberNote) lines.push(`Member's note on the order: ${r.redact(o.memberNote)}`);
  }
  const conversation = c.events.filter((e) => e.type === "MESSAGE_FROM_MEMBER" || e.type === "MESSAGE_TO_MEMBER").slice(-20);
  lines.push("", "Conversation with the member (oldest first):");
  if (!conversation.length) lines.push("(no messages yet)");
  for (const e of conversation) lines.push(`[${when(e.createdAt)}] ${e.type === "MESSAGE_FROM_MEMBER" ? "Member" : "Nomad"}: ${r.redact(e.body)}`);
  if (opts.notes) {
    const notes = c.events.filter((e) => e.type === "NOTE").slice(-8);
    if (notes.length) {
      lines.push("", "Internal staff notes (oldest first):");
      for (const e of notes) lines.push(`[${when(e.createdAt)}] ${r.redact(e.body)}`);
    }
    const activity = c.events.filter((e) => !["NOTE", "MESSAGE_FROM_MEMBER", "MESSAGE_TO_MEMBER"].includes(e.type)).slice(-15);
    if (activity.length) {
      lines.push("", "Recent activity:");
      for (const e of activity) lines.push(`[${when(e.createdAt)}] ${e.type}${e.type === "STATUS_CHANGED" || e.type === "ORDER_STATUS_CHANGED" ? ` → ${String((e.data as { to?: string } | null)?.to ?? "")}` : ""}`);
    }
  }
  return { redactor: r, text: lines.join("\n"), memberLanguage: c.requestedBy.preferredLanguage === "en" ? "en" : "fr", status: c.status, orderStep: o?.status ?? null, messages: conversation.length };
}

// ------------------------------------------------------------------- tasks

const TEST_MARK = { fr: "(Réponse de test — pas de l'IA)", en: "(Test answer — not from AI)" };

/** A reply for staff to check, edit and send. */
export async function draftReply(caseId: string, actor: Actor, staffLocale: string) {
  const ctx = await caseContext(caseId, staffLocale, { notes: false });
  const { usage, answer, budget, test } = await run("REPLY_DRAFT", actor, caseId, {
    input: ctx.text,
    mock: () =>
      ctx.memberLanguage === "en"
        ? `Hello [MEMBER], thank you for your message. We're checking${ctx.orderStep ? " your order" : " your request"} and will come back to you very shortly. ${TEST_MARK.en}`
        : `Bonjour [MEMBER], merci pour votre message. Nous vérifions ${ctx.orderStep ? "votre commande" : "votre demande"} et revenons vers vous très vite. ${TEST_MARK.fr}`,
  });
  const draft = ctx.redactor.restore(answer.text);
  await prisma.copilotUsage.update({ where: { id: usage.id }, data: { draftHash: hashDraft(draft) } });
  return { usageId: usage.id, text: draft, budget, test };
}

/** A short summary for whoever picks the case up. */
export async function summarizeCase(caseId: string, actor: Actor, staffLocale: string) {
  const ctx = await caseContext(caseId, staffLocale, { notes: true });
  const fr = staffLocale === "fr";
  const { usage, answer, budget, test } = await run("CASE_SUMMARY", actor, caseId, {
    input: ctx.text,
    mock: () =>
      [
        fr ? `- Demande : ${ctx.text.split("\n").find((l) => l.startsWith("Request from the member:"))?.slice(25, 160) ?? "inconnue"}` : `- Request: ${ctx.text.split("\n").find((l) => l.startsWith("Request from the member:"))?.slice(25, 160) ?? "unknown"}`,
        fr ? `- Statut : ${ctx.status}${ctx.orderStep ? `, commande à l'étape ${ctx.orderStep}` : ""}` : `- Status: ${ctx.status}${ctx.orderStep ? `, order at step ${ctx.orderStep}` : ""}`,
        fr ? `- Messages échangés : ${ctx.messages}` : `- Messages exchanged: ${ctx.messages}`,
        fr ? TEST_MARK.fr : TEST_MARK.en,
      ].join("\n"),
  });
  return { usageId: usage.id, text: ctx.redactor.restore(answer.text), budget, test };
}

async function pendingUsage(usageId: string, task: CopilotTask, userId: string) {
  return prisma.copilotUsage.findFirst({ where: { id: usageId, task, userId, outcome: "PENDING" } });
}

/** After staff sent a message that started from a draft: as is, or edited? */
export async function recordReplySent(usageId: string, sentBody: string, userId: string, caseId: string) {
  const u = await pendingUsage(usageId, "REPLY_DRAFT", userId);
  if (!u || u.caseId !== caseId) return;
  const outcome: CopilotOutcome = u.draftHash === hashDraft(sentBody) ? "SENT_AS_IS" : "SENT_EDITED";
  await prisma.copilotUsage.update({ where: { id: u.id }, data: { outcome, outcomeAt: new Date() } });
}

export async function dismissUsage(usageId: string, userId: string) {
  await prisma.copilotUsage.updateMany({ where: { id: usageId, userId, outcome: "PENDING" }, data: { outcome: "DISMISSED", outcomeAt: new Date() } });
}

/** Keeps a summary on the case as an internal note. */
export async function saveSummaryAsNote(usageId: string, caseId: string, text: string, userId: string, heading: string) {
  const u = await pendingUsage(usageId, "CASE_SUMMARY", userId);
  if (!u || u.caseId !== caseId) throw new Error("Summary not found");
  await addInternalNote(caseId, `${heading}\n${text}`, userId);
  await prisma.copilotUsage.update({ where: { id: u.id }, data: { outcome: "SAVED_AS_NOTE", outcomeAt: new Date() } });
}

// ------------------------------------------------------- catalog flags

const REGULATORY = ["NOT_LISTED", "LIST_II", "LIST_I", "NARCOTIC"] as const;
const flagsSchema = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      regulatoryClass: z.enum(REGULATORY),
      prescriptionRequired: z.boolean(),
      isColdChain: z.boolean(),
      isPsychotropic: z.boolean(),
      confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
      reason: z.string(),
    }),
  ),
});
const FLAGS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "regulatoryClass", "prescriptionRequired", "isColdChain", "isPsychotropic", "confidence", "reason"],
        properties: {
          code: { type: "string" },
          regulatoryClass: { type: "string", enum: [...REGULATORY] },
          prescriptionRequired: { type: "boolean" },
          isColdChain: { type: "boolean" },
          isPsychotropic: { type: "boolean" },
          confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          reason: { type: "string" },
        },
      },
    },
  },
};

/** Test answers for catalog flags: simple keyword rules, clearly marked. */
function mockFlags(items: { code: string; dci: string; form: string; therapeuticClass: string | null }[]) {
  return JSON.stringify({
    items: items.map((m) => {
      const s = `${m.dci} ${m.form} ${m.therapeuticClass ?? ""}`.toLowerCase();
      const narcotic = /morphin|fentanyl|péthidine|pethidine|méthadone|methadone|oxycod/.test(s);
      const psy = /zépam|zepam|zolpidem|phénobarb|phenobarb|halopéridol|haloperidol|amitriptyl/.test(s);
      const cold = /insulin|vaccin|ocytocin|oxytocin/.test(s);
      const rx = narcotic || psy || /inject|antibio|cilline|mycine|floxacine|céph|ceph/.test(s);
      return {
        code: m.code,
        regulatoryClass: narcotic ? "NARCOTIC" : psy ? "LIST_I" : "NOT_LISTED",
        prescriptionRequired: rx,
        isColdChain: cold,
        isPsychotropic: psy,
        confidence: "LOW",
        reason: `Réponse de test (règles simples, pas l'IA) : ${rx ? "ordonnance probable" : "rien de particulier repéré"}.`,
      };
    }),
  });
}

/** Asks for suggestions on the next catalog items nobody has looked at yet
 * (active, no suggestion so far). Returns how many were added. */
export async function suggestCatalogFlags(actor: Actor): Promise<{ added: number; remaining: number; budget: BudgetState; test: boolean }> {
  const settings = await copilotSettings();
  const where = { isActive: true, isSample: false, flagSuggestions: { none: {} } };
  const items = await prisma.medication.findMany({
    where,
    orderBy: [{ dci: "asc" }, { code: "asc" }],
    take: Math.max(1, Math.min(settings.CATALOG_BATCH_SIZE, 50)),
    select: { id: true, code: true, dci: true, brandName: true, strength: true, form: true, route: true, therapeuticClass: true, regulatoryClass: true, prescriptionRequired: true, isColdChain: true, isPsychotropic: true },
  });
  if (!items.length) return { added: 0, remaining: 0, budget: await budgetState(settings), test: aiProvider() === "mock" };
  const input = [
    "Catalog items (code | generic name | brand | strength | form | route | therapeutic class | current flags):",
    ...items.map((m) =>
      [m.code, m.dci, m.brandName ?? "", m.strength ?? "", m.form, m.route ?? "", m.therapeuticClass ?? "", `class ${m.regulatoryClass}, prescription ${m.prescriptionRequired}, cold ${m.isColdChain}, psychotropic ${m.isPsychotropic}`].join(" | "),
    ),
  ].join("\n");
  const { usage, answer, budget, test } = await run("CATALOG_FLAGS", actor, null, { input, json: { name: "catalog_flags", schema: FLAGS_JSON_SCHEMA }, mock: () => mockFlags(items) });

  let parsed: z.infer<typeof flagsSchema>;
  try {
    parsed = flagsSchema.parse(JSON.parse(answer.text));
  } catch {
    await prisma.copilotUsage.update({ where: { id: usage.id }, data: { outcome: "FAILED", outcomeAt: new Date(), error: "answer was not in the expected format" } });
    throw new CopilotBlockedError("failed");
  }
  const byCode = new Map(items.map((m) => [m.code, m]));
  const rows = parsed.items
    .filter((s) => byCode.has(s.code))
    .map((s) => ({
      medicationId: byCode.get(s.code)!.id,
      usageId: usage.id,
      regulatoryClass: s.regulatoryClass as MedicationRegulatoryClass,
      // Any listed class needs a prescription, whatever the answer says.
      prescriptionRequired: s.prescriptionRequired || s.regulatoryClass !== "NOT_LISTED",
      isColdChain: s.isColdChain,
      isPsychotropic: s.isPsychotropic,
      confidence: s.confidence,
      reason: s.reason.slice(0, 500),
    }));
  // Items the answer skipped get an empty suggestion so the batch moves on.
  const seen = new Set(rows.map((x) => x.medicationId));
  for (const m of items) {
    if (!seen.has(m.id)) rows.push({ medicationId: m.id, usageId: usage.id, regulatoryClass: m.regulatoryClass, prescriptionRequired: m.prescriptionRequired, isColdChain: m.isColdChain, isPsychotropic: m.isPsychotropic, confidence: "LOW", reason: "—" });
  }
  await prisma.copilotFlagSuggestion.createMany({ data: rows });
  return { added: rows.length, remaining: await prisma.medication.count({ where }), budget, test };
}

export function pendingFlagCount() {
  return prisma.copilotFlagSuggestion.count({ where: { status: "PENDING" } });
}

export function pendingFlagSuggestions(limit = 100) {
  return prisma.copilotFlagSuggestion.findMany({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
    include: { medication: { select: { id: true, code: true, dci: true, brandName: true, strength: true, form: true, regulatoryClass: true, prescriptionRequired: true, isColdChain: true, isPsychotropic: true } }, usage: { select: { provider: true } } },
  });
}

/** Applies (writes the suggested flags to the catalog) or dismisses one
 * suggestion. */
export async function decideFlagSuggestion(id: string, apply: boolean, actorId: string) {
  await prisma.$transaction(async (tx) => {
    const s = await tx.copilotFlagSuggestion.findUniqueOrThrow({ where: { id } });
    if (s.status !== "PENDING") return;
    if (apply) {
      await tx.medication.update({
        where: { id: s.medicationId },
        data: { regulatoryClass: s.regulatoryClass, prescriptionRequired: s.prescriptionRequired, isColdChain: s.isColdChain, isPsychotropic: s.isPsychotropic, updatedBy: actorId },
      });
      await tx.copilotUsage.updateMany({ where: { id: s.usageId, outcome: "PENDING" }, data: { outcome: "APPLIED", outcomeAt: new Date() } });
    }
    await tx.copilotFlagSuggestion.update({ where: { id }, data: { status: apply ? "APPLIED" : "DISMISSED", decidedById: actorId, decidedAt: new Date() } });
    if (!apply) {
      // The batch counts as dismissed once nothing in it was applied or is left.
      const left = await tx.copilotFlagSuggestion.count({ where: { usageId: s.usageId, status: { in: ["PENDING", "APPLIED"] } } });
      if (!left) await tx.copilotUsage.updateMany({ where: { id: s.usageId, outcome: "PENDING" }, data: { outcome: "DISMISSED", outcomeAt: new Date() } });
    }
  });
}

// ------------------------------------------------------------------ report

/** Admin > AI copilot: this month's spend, how often each button is used
 * and what staff do with the answers, and the latest uses. */
export async function copilotReport() {
  const settings = await copilotSettings();
  const since = monthStart();
  const [budget, grouped, latest, pendingFlags] = await Promise.all([
    budgetState(settings),
    prisma.copilotUsage.groupBy({ by: ["task", "outcome"], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { costMicroUsd: true } }),
    prisma.copilotUsage.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true, email: true, handle: true } }, case: { select: { id: true, caseNumber: true } } } }),
    prisma.copilotFlagSuggestion.count({ where: { status: "PENDING" } }),
  ]);
  const tasks: CopilotTask[] = ["REPLY_DRAFT", "CASE_SUMMARY", "CATALOG_FLAGS"];
  const byTask = tasks.map((task) => {
    const rows = grouped.filter((g) => g.task === task);
    const count = (o: CopilotOutcome) => rows.find((g) => g.outcome === o)?._count._all ?? 0;
    const total = rows.reduce((n, g) => n + g._count._all, 0);
    const used = count("SENT_AS_IS") + count("SENT_EDITED") + count("SAVED_AS_NOTE") + count("APPLIED");
    const decided = used + count("DISMISSED");
    return {
      task,
      total,
      costUsd: rows.reduce((n, g) => n + (g._sum.costMicroUsd ?? 0), 0) / 1_000_000,
      outcomes: Object.fromEntries((["PENDING", "SENT_AS_IS", "SENT_EDITED", "SAVED_AS_NOTE", "APPLIED", "DISMISSED", "FAILED", "BLOCKED"] as const).map((o) => [o, count(o)])) as Record<CopilotOutcome, number>,
      /** Of the answers staff decided on, how many they used. */
      usedPercent: decided ? Math.round((used / decided) * 100) : null,
    };
  });
  return { provider: aiProvider(), settings, budget, byTask, latest, pendingFlags };
}
