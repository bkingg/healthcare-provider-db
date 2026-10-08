import { z } from "zod";

/** The member app's medication order, sent as one JSON field. Error
 * messages are codes the app translates (MemberOrder.error.*). */

const uuid = z.uuid("invalid");

export const MAX_ORDER_LINES = 15;
export const MAX_QUANTITY = 20;

export const medicationOrderSchema = z
  .object({
    patientId: uuid,
    lines: z
      .array(
        z.union([
          z.object({ medicationId: uuid, quantity: z.number().int().min(1, "quantity").max(MAX_QUANTITY, "quantity") }),
          z.object({ freeText: z.string().trim().min(2, "freeText").max(200, "freeText"), quantity: z.number().int().min(1, "quantity").max(MAX_QUANTITY, "quantity") }),
        ]),
      )
      .min(1, "noItems")
      .max(MAX_ORDER_LINES, "tooManyItems"),
    /** Files already uploaded (/api/m/uploads), per requirement. */
    documents: z.array(z.object({ requirementCode: z.string().min(1).max(60), fileId: uuid })).max(20, "tooManyFiles"),
    /** Codes of "original to collect" requirements the member confirmed. */
    acknowledged: z.array(z.string().min(1).max(60)).max(10),
    when: z.enum(["WITHIN_HOUR", "TODAY", "THIS_WEEK", "ROUTINE"], "when"),
    deliveryAddress: z.string().trim().min(5, "address").max(300, "address"),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    deliveryNotes: z.string().trim().max(300, "tooLong").optional(),
    contactPhone: z.string().trim().min(1, "phone"),
    contactHasWhatsapp: z.boolean(),
    note: z.string().trim().max(1000, "tooLong").optional(),
  })
  .refine((o) => (o.latitude === undefined) === (o.longitude === undefined), { path: ["latitude"], message: "location" });

export type MedicationOrderInput = z.infer<typeof medicationOrderSchema>;
