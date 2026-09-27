import { describe, expect, it } from "vitest";
import { HANDLE_PATTERN, normalizeHandle, staffLabel, suggestHandle } from "../handle";

describe("normalizeHandle", () => {
  it("drops the @, spaces and capitals", () => {
    expect(normalizeHandle("  @Jerome ")).toBe("jerome");
    expect(normalizeHandle("@@a.Diallo")).toBe("a.diallo");
  });
});

describe("HANDLE_PATTERN", () => {
  it.each(["jerome", "a.diallo", "amadou_2", "abc"])("accepts %s", (h) => expect(HANDLE_PATTERN.test(h)).toBe(true));
  it.each(["ab", ".jerome", "jerome_", "jé rome", "jerome!", "a".repeat(31)])("rejects %s", (h) => expect(HANDLE_PATTERN.test(h)).toBe(false));
});

describe("suggestHandle", () => {
  it("uses the part of the email before @", () => {
    expect(suggestHandle("Jerome.Diallo@nomad.sn")).toBe("jerome.diallo");
    expect(suggestHandle("m-ndiaye+work@x.sn")).toBe("mndiayework");
  });
  it("gives nothing when too little is left", () => {
    expect(suggestHandle("a@x.sn")).toBe("");
  });
  it("always produces a valid handle when it produces one", () => {
    for (const e of ["_x.y_@a.sn", "averyveryveryverylongemailaddress.name@a.sn", "x.__y@a.sn"]) {
      const h = suggestHandle(e);
      if (h) expect(HANDLE_PATTERN.test(h)).toBe(true);
    }
  });
});

describe("staffLabel", () => {
  it("shows the name with the handle, or the email when there's no name", () => {
    expect(staffLabel({ name: "Jerome Diallo", email: "j@x.sn", handle: "jerome" })).toBe("Jerome Diallo (@jerome)");
    expect(staffLabel({ name: null, email: "j@x.sn", handle: "jerome" })).toBe("j@x.sn (@jerome)");
  });
});
