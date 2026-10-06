import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";

/** Reading an uploaded spreadsheet (CSV, or one sheet of an .xlsx) into
 * header → text records, shared by the bulk imports. Never throws for a bad
 * file: problems come back as fileErrors for the uploader to see. */

/** Excel cells arrive typed: real dates as Date (kept as calendar dates —
 * Excel has no time zone, so read in UTC), numbers as numbers, and links,
 * formulas and rich text as objects. Everything becomes the text a CSV
 * would have held. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    return "";
  }
  return String(value);
}

export type SheetRead = { headers: string[]; records: Record<string, string>[]; fileErrors: string[] };

/** `sheetName` is the template's data sheet; any other workbook falls back
 * to its first sheet. Blank rows are skipped. */
export async function readSheetFile(file: File, sheetName: string): Promise<SheetRead> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: "greedy" });
    return {
      headers: parsed.meta.fields ?? [],
      records: parsed.data,
      fileErrors: parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`),
    };
  }
  if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      return { headers: [], records: [], fileErrors: ["This Excel file couldn't be read. Save it as .xlsx (or CSV) and try again."] };
    }
    const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
    if (!sheet) return { headers: [], records: [], fileErrors: ["The workbook has no sheets."] };
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col] = cellText(cell.value)));
    const records: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (headers[col]) record[headers[col]] = cellText(cell.value);
      });
      if (Object.values(record).some((v) => v.trim())) records.push(record);
    });
    return { headers: headers.filter(Boolean), records, fileErrors: [] };
  }
  return { headers: [], records: [], fileErrors: ["Upload a .xlsx or .csv file."] };
}
