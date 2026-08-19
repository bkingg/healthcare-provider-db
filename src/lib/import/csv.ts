import Papa from "papaparse";

/** Expected CSV headers, mapped to `ProviderStaging` raw* columns. Header
 * matching is case-insensitive and ignores surrounding whitespace so a
 * steward's spreadsheet export doesn't need to match byte-for-byte. */
export const CSV_COLUMNS = {
  provider_name: "rawProviderName",
  provider_type_code: "rawProviderTypeCode",
  active_indicator: "rawActiveIndicator",
  country_code: "rawCountryCode",
  city: "rawCity",
  address_line1: "rawAddressLine1",
  phone: "rawPhone",
  phone_type: "rawPhoneType",
  email: "rawEmail",
  latitude: "rawLatitude",
  longitude: "rawLongitude",
  external_id: "rawExternalId",
} as const;

export type RawStagingRow = {
  [K in (typeof CSV_COLUMNS)[keyof typeof CSV_COLUMNS]]?: string;
};

export type ParsedCsv = {
  rows: RawStagingRow[];
  errors: string[];
};

/** Parses CSV text into raw staging-row shapes. Never throws — parse errors
 * (malformed quoting, etc.) are collected and surfaced to the uploader rather
 * than silently dropping rows; unmapped columns are ignored, missing expected
 * columns just mean that field stays undefined for every row. */
export function parseProviderCsv(csvText: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const rows: RawStagingRow[] = result.data.map((record) => {
    const row: RawStagingRow = {};
    for (const [csvHeader, field] of Object.entries(CSV_COLUMNS)) {
      const value = record[csvHeader]?.trim();
      if (value) row[field] = value;
    }
    return row;
  });

  const errors = result.errors.map((e) => `Row ${e.row ?? "?"}: ${e.message}`);
  return { rows, errors };
}
