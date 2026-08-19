import { CoordinateStatus, ProviderStatus } from "@/lib/enums";
import type { RawStagingRow } from "./csv";

export type ReferenceMaps = {
  countryByIso2: Map<string, string>;
  providerTypeByCode: Map<string, string>;
  phoneTypeByCode: Map<string, string>;
  defaultAddressTypeId: string;
  defaultEmailTypeId: string;
  defaultPhoneTypeId: string;
};

export type RowException = {
  ruleCode: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  fieldName?: string;
  fieldValue?: string;
};

export type ResolvedRow = {
  providerTypeId: string;
  countryId: string;
  status: ProviderStatus;
  fullNameText: string;
  externalId?: string;
  address?: {
    line1: string;
    city: string;
    addressTypeId: string;
    countryId: string;
    latitude?: number;
    longitude?: number;
    coordinateStatus: CoordinateStatus;
  };
  phone?: { number: string; phoneTypeId: string };
  email?: { address: string };
};

export type ValidationOutcome =
  | { outcome: "REJECTED"; exceptions: RowException[] }
  | { outcome: "VALIDATED"; resolved: ResolvedRow; exceptions: RowException[] };

const TRUE_VALUES = new Set(["true", "1", "active", "yes", "y"]);
const FALSE_VALUES = new Set(["false", "0", "inactive", "no", "n"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure implementation of the Phase 4 reject/exception matrix — no DB access,
 * so it's straightforward to reason about and re-run in isolation. Reference
 * lookups and duplicate-candidate detection (which need the database) are
 * resolved by the caller (`src/data/importBatches.ts`) and passed in / merged
 * in afterward. */
export function validateRow(row: RawStagingRow, refs: ReferenceMaps): ValidationOutcome {
  const exceptions: RowException[] = [];

  // --- Reject-level checks: identity/structural, can't create the row at all.
  if (!row.rawProviderName) {
    return {
      outcome: "REJECTED",
      exceptions: [{ ruleCode: "MISSING_REQUIRED_FIELD", severity: "CRITICAL", fieldName: "provider_name" }],
    };
  }
  if (!row.rawProviderTypeCode) {
    return {
      outcome: "REJECTED",
      exceptions: [{ ruleCode: "MISSING_REQUIRED_FIELD", severity: "CRITICAL", fieldName: "provider_type_code" }],
    };
  }
  if (!row.rawCountryCode) {
    return {
      outcome: "REJECTED",
      exceptions: [{ ruleCode: "MISSING_REQUIRED_FIELD", severity: "CRITICAL", fieldName: "country_code" }],
    };
  }
  if (!row.rawActiveIndicator) {
    return {
      outcome: "REJECTED",
      exceptions: [{ ruleCode: "MISSING_REQUIRED_FIELD", severity: "CRITICAL", fieldName: "active_indicator" }],
    };
  }

  const providerTypeId = refs.providerTypeByCode.get(row.rawProviderTypeCode.toUpperCase());
  if (!providerTypeId) {
    return {
      outcome: "REJECTED",
      exceptions: [
        { ruleCode: "INVALID_LOOKUP_VALUE", severity: "CRITICAL", fieldName: "provider_type_code", fieldValue: row.rawProviderTypeCode },
      ],
    };
  }

  const countryId = refs.countryByIso2.get(row.rawCountryCode.toUpperCase());
  if (!countryId) {
    return {
      outcome: "REJECTED",
      exceptions: [{ ruleCode: "INVALID_LOOKUP_VALUE", severity: "CRITICAL", fieldName: "country_code", fieldValue: row.rawCountryCode }],
    };
  }

  // --- Exception-level checks: row still gets created, steward reviews.
  const activeIndicator = row.rawActiveIndicator.trim().toLowerCase();
  let status: ProviderStatus = ProviderStatus.PENDING_REVIEW;
  if (TRUE_VALUES.has(activeIndicator)) {
    status = ProviderStatus.ACTIVE;
  } else if (!FALSE_VALUES.has(activeIndicator)) {
    exceptions.push({
      ruleCode: "INVALID_ACTIVE_INDICATOR",
      severity: "ERROR",
      fieldName: "active_indicator",
      fieldValue: row.rawActiveIndicator,
    });
  }

  let address: ResolvedRow["address"];
  if (row.rawAddressLine1 || row.rawCity) {
    let latitude: number | undefined;
    let longitude: number | undefined;
    let coordinateStatus: CoordinateStatus = CoordinateStatus.MISSING;

    if (row.rawLatitude || row.rawLongitude) {
      const lat = row.rawLatitude ? Number(row.rawLatitude) : NaN;
      const lng = row.rawLongitude ? Number(row.rawLongitude) : NaN;
      const valid = !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      if (valid) {
        latitude = lat;
        longitude = lng;
        coordinateStatus = CoordinateStatus.UNCONFIRMED;
      } else {
        exceptions.push({
          ruleCode: "INVALID_COORDINATES",
          severity: "WARNING",
          fieldName: "latitude/longitude",
          fieldValue: `${row.rawLatitude ?? ""},${row.rawLongitude ?? ""}`,
        });
      }
    }

    address = {
      line1: row.rawAddressLine1 ?? row.rawCity ?? "",
      city: row.rawCity ?? "",
      addressTypeId: refs.defaultAddressTypeId,
      countryId,
      latitude,
      longitude,
      coordinateStatus,
    };
  }

  let phone: ResolvedRow["phone"];
  if (row.rawPhone) {
    const phoneTypeId = row.rawPhoneType ? refs.phoneTypeByCode.get(row.rawPhoneType.toUpperCase()) : undefined;
    if (row.rawPhoneType && !phoneTypeId) {
      exceptions.push({ ruleCode: "MISSING_PHONE_TYPE", severity: "INFO", fieldName: "phone_type", fieldValue: row.rawPhoneType });
    } else if (!row.rawPhoneType) {
      exceptions.push({ ruleCode: "MISSING_PHONE_TYPE", severity: "INFO", fieldName: "phone_type" });
    }
    phone = { number: row.rawPhone, phoneTypeId: phoneTypeId ?? refs.defaultPhoneTypeId };
  }

  let email: ResolvedRow["email"];
  if (row.rawEmail) {
    if (EMAIL_PATTERN.test(row.rawEmail)) {
      email = { address: row.rawEmail };
    } else {
      exceptions.push({ ruleCode: "INVALID_EMAIL_FORMAT", severity: "WARNING", fieldName: "email", fieldValue: row.rawEmail });
    }
  }

  if (!address && !phone && !email) {
    exceptions.push({ ruleCode: "MISSING_CONTACT_OR_LOCATION", severity: "WARNING" });
  }

  return {
    outcome: "VALIDATED",
    resolved: {
      providerTypeId,
      countryId,
      status,
      fullNameText: row.rawProviderName,
      externalId: row.rawExternalId,
      address,
      phone,
      email,
    },
    exceptions,
  };
}
