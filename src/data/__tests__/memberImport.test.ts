import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { excelSerialToIsoDate, readMemberFile } = await import("@/data/memberImport");

describe("excelSerialToIsoDate", () => {
  it("turns Excel day numbers into dates", () => {
    expect(excelSerialToIsoDate("32947")).toBe("1990-03-15");
    expect(excelSerialToIsoDate("46022")).toBe("2025-12-31");
    expect(excelSerialToIsoDate("46022.5")).toBe("2025-12-31");
  });
  it("leaves anything else alone", () => {
    for (const v of ["15/03/1990", "1990-03-15", "12", "999999"]) expect(excelSerialToIsoDate(v)).toBe(v);
  });
});

describe("readMemberFile", () => {
  it("reads CSV rows by header, ignoring case and spacing", async () => {
    const file = new File(["Household ID,First Name,last_name,Date of Birth,unknown\nH1,Awa,Sow,12/04/1986,x\n"], "m.csv");
    const { rows, fileErrors } = await readMemberFile(file);
    expect(fileErrors).toEqual([]);
    expect(rows).toEqual([{ household_id: "H1", first_name: "Awa", last_name: "Sow", date_of_birth: "12/04/1986" }]);
  });
  it("reports missing required columns and unsupported file types", async () => {
    const missing = await readMemberFile(new File(["first_name,last_name\nA,B\n"], "m.csv"));
    expect(missing.fileErrors[0]).toMatch(/household_id/);
    const wrong = await readMemberFile(new File(["x"], "m.pdf"));
    expect(wrong.fileErrors[0]).toMatch(/\.xlsx or \.csv/);
  });
});
