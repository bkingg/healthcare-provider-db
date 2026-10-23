import "server-only";
import OpenAI from "openai";

/** The AI behind the copilot, chosen by AI_PROVIDER:
 * - "off" (default): copilot buttons hidden;
 * - "mock": test answers, made up locally — for building and testing
 *   without an OpenAI account. Each is clearly marked as a test answer;
 * - "openai": OpenAI's Responses API (OPENAI_API_KEY, AI_MODEL).
 * Only text is ever sent. Responses aren't stored by OpenAI (store: false). */

export type AiProvider = "off" | "mock" | "openai";

export function aiProvider(): AiProvider {
  const p = process.env.AI_PROVIDER;
  if (p === "openai") return process.env.OPENAI_API_KEY ? "openai" : "off";
  return p === "mock" ? "mock" : "off";
}

export const aiModel = () => process.env.AI_MODEL || "gpt-5-mini";

export type AiRequest = {
  instructions: string;
  input: string;
  maxOutputTokens: number;
  /** Ask for JSON matching this schema (strict). */
  json?: { name: string; schema: Record<string, unknown> };
  /** The test answer, for AI_PROVIDER=mock. */
  mock: () => string;
};

export type AiAnswer = { text: string; inputTokens: number; outputTokens: number; estimated: boolean; provider: "mock" | "openai"; model: string };

export class AiUnavailableError extends Error {}

/** About 4 characters a token — only for test answers. */
const estimateTokens = (s: string) => Math.ceil(s.length / 4);

let client: OpenAI | null = null;

export async function askAi(req: AiRequest): Promise<AiAnswer> {
  const provider = aiProvider();
  if (provider === "off") throw new AiUnavailableError("The copilot is switched off.");
  if (provider === "mock") {
    // To see exactly what would leave Nomad (already de-identified).
    if (process.env.AI_LOG_INPUT === "1") console.info(`[copilot] would send:\n${req.input}`);
    const text = req.mock();
    return { text, inputTokens: estimateTokens(req.instructions + req.input), outputTokens: estimateTokens(text), estimated: true, provider: "mock", model: "test-answers" };
  }

  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const effort = process.env.AI_REASONING_EFFORT;
  const res = await client.responses.create({
    model: aiModel(),
    instructions: req.instructions,
    input: req.input,
    max_output_tokens: req.maxOutputTokens,
    store: false,
    ...(effort === "minimal" || effort === "low" || effort === "medium" ? { reasoning: { effort } } : {}),
    ...(req.json ? { text: { format: { type: "json_schema" as const, name: req.json.name, schema: req.json.schema, strict: true } } } : {}),
  });
  if (res.status === "incomplete") throw new Error(`incomplete: ${res.incomplete_details?.reason ?? "unknown"}`);
  const text = res.output_text.trim();
  if (!text) throw new Error("empty answer");
  return { text, inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, estimated: false, provider: "openai", model: res.model ?? aiModel() };
}
