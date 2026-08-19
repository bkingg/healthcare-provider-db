import "server-only";
import ExcelJS from "exceljs";
import { formatDakarDateTime } from "@/lib/formatDate";
import { formatProviderNumber } from "@/lib/providerNumber";
import type { AdministrativeContactReportRow } from "@/data/reports";

// Same fixed-language/format rule as the provider main report.
const REPORT_LOCALE = "en";

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: "Provider ID", key: "providerId", width: 14 },
  { header: "Provider Name", key: "providerName", width: 32 },
  { header: "Title", key: "title", width: 12 },
  { header: "First Name", key: "firstName", width: 18 },
  { header: "Last Name", key: "lastName", width: 18 },
  { header: "Job Title", key: "jobTitle", width: 22 },
  { header: "Department", key: "department", width: 20 },
  { header: "Phone Numbers", key: "phones", width: 36 },
  { header: "Email Addresses", key: "emails", width: 44 },
  { header: "Notes", key: "notes", width: 40 },
  { header: "Active", key: "active", width: 10 },
  { header: "Created Date", key: "createdDate", width: 22 },
  { header: "Last Update", key: "lastUpdate", width: 22 },
];

/** Builds the "Administrative contacts report" workbook — one row per
 * contact. A contact's several phones/emails go into a single comma-separated
 * cell, each as "value (Type)" (the type is left off numbers saved before
 * types existed). */
export async function buildAdminContactReportWorkbook(rows: AdministrativeContactReportRow[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Provider Network";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Administrative contacts");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const c of rows) {
    sheet.addRow({
      providerId: formatProviderNumber(c.provider.providerNumber),
      providerName: c.provider.names[0]?.fullNameText ?? "",
      title: c.title ?? "",
      firstName: c.firstName,
      lastName: c.lastName,
      jobTitle: c.jobTitle ?? "",
      department: c.department?.name ?? "",
      phones: c.phones.map((p) => (p.phoneType ? `${p.number} (${p.phoneType.name})` : p.number)).join(", "),
      emails: c.emails.map((e) => (e.emailType ? `${e.address} (${e.emailType.name})` : e.address)).join(", "),
      notes: c.notes ?? "",
      active: c.isActive ? "Yes" : "No",
      createdDate: formatDakarDateTime(c.createdAt, REPORT_LOCALE),
      lastUpdate: formatDakarDateTime(c.updatedAt, REPORT_LOCALE),
    });
  }

  return workbook.xlsx.writeBuffer();
}
