"use server";

import { quoteByToken, QuoteAnswerError, saveQuoteAnswer } from "@/data/pharmacyQuotes";
import { quoteAnswerSchema } from "@/lib/validation/quoteAnswer";

export type QuoteFormState = { ok: true; declined: boolean } | { ok: false; error: string } | null;

/** A pharmacy sends (or updates) its answer through its private link. */
export async function submitQuoteAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const token = String(formData.get("token") ?? "");
  const quote = await quoteByToken(token);
  if (!quote) return { ok: false, error: "linkGone" };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("answer") ?? ""));
  } catch {
    return { ok: false, error: "invalid" };
  }
  const parsed = quoteAnswerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  try {
    await saveQuoteAnswer(quote.id, parsed.data.decline ? { ...parsed.data, lines: [] } : parsed.data, null);
  } catch (err) {
    if (err instanceof QuoteAnswerError) return { ok: false, error: err.message === "decided" ? "decided" : "invalid" };
    throw err;
  }
  return { ok: true, declined: parsed.data.decline };
}
