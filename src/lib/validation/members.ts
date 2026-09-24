import { z } from "zod";
import { optionalIsoDate, optionalString, optionalUuid, requiredString, uuidSchema } from "./common";

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .pipe(z.email("Enter a valid email address").optional());

/** The member add/edit form. Household rules that need the database (the
 * chosen primary must itself be a primary member, a member with dependents
 * can't become a dependent) are checked in src/data/members.ts; everything
 * checkable from the form alone is checked here. */
const memberFields = z
  .object({
    firstName: requiredString("First name"),
    lastName: requiredString("Last name"),
    dateOfBirth: optionalIsoDate,
    sex: z.enum(["FEMALE", "MALE", "UNSPECIFIED"]).default("UNSPECIFIED"),
    email: optionalEmail,
    phone: optionalString,
    preferredLanguage: z.enum(["fr", "en"]).default("fr"),
    countryId: optionalUuid,
    city: optionalString,
    primaryMemberId: optionalUuid,
    relationshipId: optionalUuid,
    organizationId: optionalUuid,
    planName: optionalString,
    policyNumber: optionalString,
    coverageStart: optionalIsoDate,
    coverageEnd: optionalIsoDate,
  })
  .refine((m) => !m.primaryMemberId || m.relationshipId, {
    path: ["relationshipId"],
    message: "Choose how this dependent is related to the primary member",
  })
  .refine((m) => !m.coverageStart || !m.coverageEnd || m.coverageEnd >= m.coverageStart, {
    path: ["coverageEnd"],
    message: "Coverage can't end before it starts",
  })
  .refine((m) => !m.dateOfBirth || m.dateOfBirth <= new Date(), {
    path: ["dateOfBirth"],
    message: "Date of birth can't be in the future",
  });

export const createMemberSchema = memberFields;
export const updateMemberSchema = z.intersection(z.object({ id: uuidSchema }), memberFields);

export type MemberInput = z.infer<typeof memberFields>;

export const memberSearchSchema = z.object({
  q: optionalString,
  organizationId: optionalUuid,
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).catch("ACTIVE"),
});
