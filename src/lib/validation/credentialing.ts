import { z } from "zod";
import { ContractStatus } from "@/lib/enums";
import { optionalIsoDate, optionalString, requiredIsoDate, uuidSchema } from "./common";

export const credentialSchema = z.object({
  providerId: uuidSchema,
  credentialTypeId: uuidSchema,
  statusId: uuidSchema,
  documentUrl: optionalString,
  issuedDate: optionalIsoDate,
  validationDate: optionalIsoDate,
  reviewedById: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.uuid().optional()),
  expirationDate: optionalIsoDate,
  renewalDate: optionalIsoDate,
  notes: optionalString,
});
export type CredentialInput = z.infer<typeof credentialSchema>;

export const networkContractSchema = z.object({
  providerId: uuidSchema,
  networkId: uuidSchema,
  status: z.enum(ContractStatus).default(ContractStatus.DRAFT),
  effectiveDate: requiredIsoDate,
  endDate: optionalIsoDate,
  terms: optionalString,
  documentUrl: optionalString,
  // The network's own identifier for this contract — see
  // NetworkContract.externalReferenceId in schema.prisma. Free text, not
  // validated against any format: it belongs to whichever external system
  // issued it, not to this app.
  externalReferenceId: optionalString,
  comments: optionalString,
});
export type NetworkContractInput = z.infer<typeof networkContractSchema>;

export const updateNetworkContractSchema = networkContractSchema.extend({ id: uuidSchema });
export type UpdateNetworkContractInput = z.infer<typeof updateNetworkContractSchema>;

export const affiliationSchema = z
  .object({
    providerId: uuidSchema,
    relatedProviderId: uuidSchema,
    affiliationTypeId: uuidSchema,
    effectiveDate: optionalIsoDate,
    endDate: optionalIsoDate,
    notes: optionalString,
  })
  .refine((data) => data.providerId !== data.relatedProviderId, {
    message: "A provider cannot be affiliated with itself",
    path: ["relatedProviderId"],
  });
export type AffiliationInput = z.infer<typeof affiliationSchema>;

/** Only the relationship type is editable — the two providers being related
 * are the affiliation's identity, not a field you'd "edit" without really
 * creating a different relationship (delete and re-add covers that case).
 * `providerId` here is whichever provider's profile the edit was opened
 * from (for revalidation/touch), not necessarily Affiliation.providerId —
 * see affiliations-section.tsx, which shows the same row from either side. */
export const updateAffiliationSchema = z.object({
  id: uuidSchema,
  providerId: uuidSchema,
  affiliationTypeId: uuidSchema,
});
export type UpdateAffiliationInput = z.infer<typeof updateAffiliationSchema>;
