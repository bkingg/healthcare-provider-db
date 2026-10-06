import { z } from "zod";

/** A pharmacy's answer on its quote page (or entered by staff from a call).
 * Error messages are codes the page translates (Quote.error.*). */
export const quoteAnswerSchema = z.discriminatedUnion("decline", [
  z.object({ decline: z.literal(true), pharmacistName: z.string().trim().max(100).optional(), note: z.string().trim().max(500).optional(), lines: z.array(z.unknown()).max(0).optional().default([]) }),
  z.object({
    decline: z.literal(false),
    preparationMinutes: z.number().int().min(0, "prep").max(24 * 60, "prep"),
    canDispenseNarcotic: z.boolean().optional(),
    canPackColdChain: z.boolean().optional(),
    pharmacistName: z.string().trim().max(100).optional(),
    note: z.string().trim().max(500).optional(),
    lines: z
      .array(
        z
          .object({
            orderLineId: z.uuid(),
            availability: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE"]),
            quantityOffered: z.number().int().min(1, "quantity").max(100, "quantity").optional(),
            packPriceXof: z.number().int().min(1, "price").max(5_000_000, "price").optional(),
            packDescription: z.string().trim().max(100).optional(),
            unitsPerPack: z.number().int().min(1).max(10_000).optional(),
            substitution: z.string().trim().max(200).optional(),
          })
          .refine((l) => l.availability === "UNAVAILABLE" || l.packPriceXof !== undefined, { path: ["packPriceXof"], message: "price" })
          .refine((l) => l.availability !== "PARTIAL" || l.quantityOffered !== undefined, { path: ["quantityOffered"], message: "quantity" }),
      )
      .min(1),
  }),
]);

export type QuoteAnswerInput = z.infer<typeof quoteAnswerSchema>;
