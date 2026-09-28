import { z } from "zod";
import { parseDueInput } from "@/lib/caseActions";

/** The staff "New case" form (a call, email, WhatsApp or walk-in). Error
 * messages are codes the screen translates (Cases.newCase.error.*). The
 * next action's fields are checked by the action's own parser. */

const uuid = z.uuid("required");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));
const flag = z
  .string()
  .optional()
  .transform((v) => v === "1");

const newPersonSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(100, "tooLong"),
  lastName: z.string().trim().min(1, "required").max(100, "tooLong"),
  dateOfBirth: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const d = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d > new Date()) {
        ctx.addIssue({ code: "custom", message: "dateOfBirth" });
        return z.NEVER;
      }
      return d;
    }),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined))
    .pipe(z.email("email").optional()),
  preferredLanguage: z.enum(["fr", "en"]).catch("fr"),
  countryId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.uuid("required").optional()),
  isCovered: flag,
});

export const staffCaseSchema = z
  .object({
    requesterId: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(uuid.optional()),
    patientId: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(uuid.optional()),
    newPerson: newPersonSchema.optional(),
    channel: z.enum(["PHONE", "EMAIL", "WHATSAPP", "WALK_IN"], "required"),
    contactedAt: z.string().transform((v, ctx) => {
      const d = parseDueInput(v);
      const now = Date.now();
      // Up to 30 days back (a message found late); not in the future.
      if (!d || d.getTime() > now + 5 * 60_000 || d.getTime() < now - 30 * 86_400_000) {
        ctx.addIssue({ code: "custom", message: "contactedAt" });
        return z.NEVER;
      }
      return d;
    }),
    categoryId: uuid,
    urgency: z.enum(["EMERGENCY", "TODAY", "THIS_WEEK", "ROUTINE"], "required"),
    description: z.string().trim().min(5, "description").max(4000, "tooLong"),
    /** Checked and formatted in the action (lib/phone.ts). */
    contactPhone: z.string().trim().min(1, "phone"),
    contactHasWhatsapp: flag,
    locationLabel: optionalText(200),
    coverage: z.enum(["COVERED", "SPECIAL_FREE", "SPECIAL_PAID"], "required"),
    colourRag: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.enum(["GREEN", "YELLOW", "RED"]).optional()),
    colourReason: optionalText(500),
    status: z.enum(["NEW", "IN_PROGRESS"]).catch("NEW"),
    assigneeId: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(uuid.optional()),
    visibleToMember: flag,
    note: optionalText(4000),
  })
  .refine((v) => v.newPerson || v.requesterId, { path: ["requesterId"], message: "requester" });

export type StaffCaseForm = z.infer<typeof staffCaseSchema>;

/** What data/staffCases.ts receives: the form, with the colour choice and
 * next action resolved by the Server Action. */
export type StaffCaseInput = Omit<StaffCaseForm, "colourRag" | "colourReason"> & {
  colour?: { rag: "GREEN" | "YELLOW" | "RED"; reason: string };
  action?: { title: string; ownerId: string; dueAt: Date };
};

/** FormData → the shape staffCaseSchema reads: the "New person" fields
 * (np_*) become `newPerson` when that section is in use. */
export function staffCaseFormObject(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const obj: Record<string, unknown> = { ...raw };
  if (raw.addNewPerson === "1") {
    obj.newPerson = {
      firstName: raw.np_firstName,
      lastName: raw.np_lastName,
      dateOfBirth: raw.np_dateOfBirth,
      phone: raw.np_phone,
      email: raw.np_email,
      preferredLanguage: raw.np_preferredLanguage,
      countryId: raw.np_countryId,
      isCovered: raw.np_isCovered,
    };
    delete obj.requesterId;
    delete obj.patientId;
  }
  return obj;
}
