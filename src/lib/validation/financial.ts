import { z } from "zod";
import { decimalString, optionalDecimalString, optionalIsoDate, optionalString, optionalUuid, requiredIsoDate, requiredString, uuidSchema } from "./common";

export const bankingPaymentSchema = z.object({
  providerId: uuidSchema,
  payeeName: requiredString("Payee name"),
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .toUpperCase(),
  paymentTypeId: uuidSchema,
  bankName: optionalString,
  bankAccountNumber: optionalString,
  bankRoutingOrSwift: optionalString,
  bankAccountTypeId: optionalUuid,
  /** Mobile money payment types only — checked against the payment type's category in the action. */
  mobileMoneyNumber: optionalString,
  merchantCode: optionalString,
  /** Freeform JSON for country-specific fields (NINEA/TIN, IBAN, ...). Validated
   * as parseable JSON here; the DAL stores it as-is in the `Json` column. */
  countrySpecificFieldsRaw: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || safeJsonParse(v) !== undefined, "Must be valid JSON"),
});
export type BankingPaymentInput = z.infer<typeof bankingPaymentSchema>;

export const rateSchema = z.object({
  providerId: uuidSchema,
  serviceTypeId: uuidSchema,
  description: optionalString,
  price: decimalString,
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
  discountPercent: optionalDecimalString,
  effectiveDate: requiredIsoDate,
  endDate: optionalIsoDate,
  source: optionalString,
});
export type RateInput = z.infer<typeof rateSchema>;

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
