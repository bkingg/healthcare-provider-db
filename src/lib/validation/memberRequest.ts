import { z } from "zod";
import { optionalString, uuidSchema } from "./common";

const optionalCoordinate = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().min(min).max(max).optional());

/** The member app's "Request help" form. */
export const memberRequestSchema = z.object({
  patientId: uuidSchema,
  categoryId: uuidSchema,
  description: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters).")
    .max(2000, "Please keep it under 2,000 characters."),
  urgency: z.enum(["EMERGENCY", "TODAY", "THIS_WEEK", "ROUTINE"]),
  /** Checked and formatted in the action (lib/phone.ts normalizeCallbackPhone),
   * which knows the member's country for numbers typed without a code. */
  contactPhone: z.string().trim().min(1, "Enter a phone number we can call."),
  contactHasWhatsapp: z
    .string()
    .optional()
    .transform((v) => v === "1"),
  locationLabel: optionalString.pipe(z.string().max(200).optional()),
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
});

export type MemberRequestInput = z.infer<typeof memberRequestSchema>;
