import "server-only";
import { formatProviderNumber } from "@/lib/providerNumber";
import ExcelJS from "exceljs";
import { formatDakarDateTime } from "@/lib/formatDate";
import { formatTimeOfDay } from "@/lib/officeHours";
import type { ProviderReportRow } from "@/data/reports";

// A data export stays in one consistent language/format regardless of who
// requests it — same reasoning as spreadsheet tooling generally expecting a
// stable schema, not one that shifts with the requester's UI locale.
const REPORT_LOCALE = "en";

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: "Provider ID", key: "providerId", width: 14 },
  { header: "Name", key: "name", width: 32 },
  { header: "Status", key: "status", width: 16 },
  { header: "Quality Rating", key: "qualityRating", width: 14 },
  { header: "Access Rating", key: "accessRating", width: 14 },
  { header: "Healthcare System Rating", key: "healthcareSystemRating", width: 24 },
  { header: "Address", key: "address", width: 44 },
  { header: "Primary Contact", key: "primaryContact", width: 20 },
  { header: "Primary Email", key: "primaryEmail", width: 28 },
  { header: "Internal Comment", key: "internalComment", width: 40 },
  { header: "External Comment", key: "externalComment", width: 40 },
  { header: "Created Date", key: "createdDate", width: 22 },
  { header: "Last Update", key: "lastUpdate", width: 22 },
  { header: "Validation Date", key: "validationDate", width: 22 },
  { header: "Geo Coordinates Validation Date", key: "geoValidationDate", width: 30 },
  { header: "Provider Types", key: "providerTypes", width: 28 },
  { header: "Specialties", key: "specialties", width: 34 },
  { header: "Languages", key: "languages", width: 24 },
  { header: "Networks Accepted", key: "networksAccepted", width: 34 },
  { header: "Affiliated Providers", key: "affiliatedProviders", width: 40 },
  { header: "Facility Open 24/7", key: "facilityOpen247", width: 16 },
  { header: "ER Open 24/7", key: "erOpen247", width: 14 },
  { header: "Office Hours", key: "officeHours", width: 60 },
];

function formatOfficeHours(officeHours: ProviderReportRow["officeHours"]): string {
  return officeHours
    .map((oh) => `${DAY_LABELS[oh.dayOfWeek] ?? oh.dayOfWeek} ${formatTimeOfDay(oh.openTime)}-${formatTimeOfDay(oh.closeTime)}`)
    .join("; ");
}

/** Builds the "Provider main report" workbook — one row per provider,
 * covering identity, contact, comments, audit timestamps (all Dakar-time,
 * matching the same convention the profile page's own stamps use — see
 * formatDakarDateTime's callers in provider-header.tsx/addresses-section.tsx),
 * and clinical-service content. */
export async function buildProviderReportWorkbook(rows: ProviderReportRow[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Provider Network";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Providers");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const p of rows) {
    const address = p.addresses[0];
    // No enforced subject/related direction on Affiliation (see the query's
    // own comment) — both sides joined the same way, same as the results
    // table's "Facility" column.
    const affiliatedProviders = [
      ...p.affiliationsAsSubject.map((a) => a.relatedProvider.names[0]?.fullNameText),
      ...p.affiliationsAsRelated.map((a) => a.provider.names[0]?.fullNameText),
    ].filter(Boolean);

    sheet.addRow({
      providerId: formatProviderNumber(p.providerNumber),
      name: p.names[0]?.fullNameText ?? "",
      status: p.status,
      qualityRating: p.qualityRating ?? "",
      accessRating: p.accessRating ?? "",
      healthcareSystemRating: p.country.qualityRating?.numericValue ? p.country.qualityRating.label : "",
      address: address ? [address.line1, address.city, address.country?.name].filter(Boolean).join(", ") : "",
      primaryContact: p.phones[0]?.number ?? "",
      primaryEmail: p.emails[0]?.address ?? "",
      internalComment: p.internalNotes ?? "",
      externalComment: p.externalNotes ?? "",
      createdDate: formatDakarDateTime(p.createdAt, REPORT_LOCALE),
      lastUpdate: formatDakarDateTime(p.updatedAt, REPORT_LOCALE),
      validationDate: p.lastVerifiedAt ? formatDakarDateTime(p.lastVerifiedAt, REPORT_LOCALE) : "",
      geoValidationDate: address ? formatDakarDateTime(address.updatedAt, REPORT_LOCALE) : "",
      providerTypes: p.providerTypes.map((pt) => pt.providerType.nameEn).join(", "),
      specialties: p.specialties.map((s) => s.specialty.nameEn).join(", "),
      languages: p.languages.map((l) => l.language.nameEn).join(", "),
      networksAccepted: p.networkContracts.map((nc) => nc.network.name).join(", "),
      affiliatedProviders: affiliatedProviders.join(", "),
      facilityOpen247: p.isOpen24_7 ? "Yes" : "No",
      erOpen247: p.erOpen24_7 ? "Yes" : "No",
      officeHours: formatOfficeHours(p.officeHours),
    });
  }

  return workbook.xlsx.writeBuffer();
}
