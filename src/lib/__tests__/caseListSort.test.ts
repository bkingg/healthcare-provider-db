import { describe, expect, it } from "vitest";
import { nextSort, parseCaseSort, sortByValue } from "@/lib/caseListSort";

describe("parseCaseSort", () => {
  it("falls back to newest first, and to each column's natural direction", () => {
    expect(parseCaseSort(undefined, undefined)).toEqual({ key: "created", dir: "desc" });
    expect(parseCaseSort("nonsense", "up")).toEqual({ key: "created", dir: "desc" });
    expect(parseCaseSort("priority", undefined)).toEqual({ key: "priority", dir: "asc" });
    expect(parseCaseSort("created", undefined)).toEqual({ key: "created", dir: "desc" });
    expect(parseCaseSort("patient", "desc")).toEqual({ key: "patient", dir: "desc" });
  });
});

describe("nextSort", () => {
  it("flips the same column, starts a new one in its natural direction", () => {
    expect(nextSort({ key: "patient", dir: "asc" }, "patient")).toEqual({ key: "patient", dir: "desc" });
    expect(nextSort({ key: "patient", dir: "asc" }, "created")).toEqual({ key: "created", dir: "desc" });
  });
});

describe("sortByValue", () => {
  const rows = [
    { n: "Élodie", d: 3 },
    { n: "awa", d: null },
    { n: "Bineta", d: 1 },
    { n: "", d: 2 },
  ];
  it("sorts text case- and accent-blind, empty last both ways", () => {
    expect(sortByValue(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual(["awa", "Bineta", "Élodie", ""]);
    expect(sortByValue(rows, (r) => r.n, "desc").map((r) => r.n)).toEqual(["Élodie", "Bineta", "awa", ""]);
  });
  it("sorts numbers, nulls last both ways", () => {
    expect(sortByValue(rows, (r) => r.d, "asc").map((r) => r.d)).toEqual([1, 2, 3, null]);
    expect(sortByValue(rows, (r) => r.d, "desc").map((r) => r.d)).toEqual([3, 2, 1, null]);
  });
  it("uses later values to break ties, and keeps the original order otherwise", () => {
    const items = [{ a: 1, b: 2, id: "x" }, { a: 1, b: 1, id: "y" }, { a: 0, b: 9, id: "z" }, { a: 1, b: 1, id: "w" }];
    expect(sortByValue(items, (i) => [i.a, i.b], "asc").map((i) => i.id)).toEqual(["z", "y", "w", "x"]);
  });
  it("compares numbers inside text in number order", () => {
    expect(sortByValue([{ c: "CAS-000010" }, { c: "CAS-000009" }], (r) => r.c, "asc").map((r) => r.c)).toEqual(["CAS-000009", "CAS-000010"]);
  });
});
