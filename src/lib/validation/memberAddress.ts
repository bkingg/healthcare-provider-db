import { z } from "zod";

/** A saved address (the member's primary address). Messages are codes the
 * forms translate. */
export const memberAddressSchema = z
  .object({
    addressText: z.string().trim().min(5, "address").max(300, "address"),
    directions: z
      .string()
      .trim()
      .max(300, "tooLong")
      .optional()
      .transform((v) => (v ? v : null)),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((a) => (a.latitude === undefined) === (a.longitude === undefined), { path: ["latitude"], message: "location" });

export type MemberAddressInput = z.infer<typeof memberAddressSchema>;
