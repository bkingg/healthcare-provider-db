import { describe, expect, it } from "vitest";
import { buildGridTemplate, PROVIDER_COLUMNS, type ProviderColumnKey } from "../column-visibility";

const ALL: ProviderColumnKey[] = PROVIDER_COLUMNS.map((c) => c.key);

describe("buildGridTemplate", () => {
  it("uses the default tracks, in default order, when nothing has been changed", () => {
    const { template, minWidth } = buildGridTemplate(ALL, {});
    expect(template).toBe("28px 88px minmax(160px,1.6fr) 110px 120px minmax(120px,1.2fr) minmax(110px,1fr) 92px 84px 62px");
    // Sum of every track's minimum plus row padding, still above the 900px floor.
    expect(minWidth).toBe(40 + 28 + 88 + 160 + 110 + 120 + 120 + 110 + 92 + 84 + 62);
  });

  it("follows the order it's given, keeping the row checkbox first", () => {
    const { template } = buildGridTemplate(["rating", "name", "providerId"], {});
    expect(template).toBe("28px 62px minmax(160px,1.6fr) 88px");
  });

  it("swaps in saved px widths, including for the Name column", () => {
    const { template } = buildGridTemplate(["name", "type"], { "col:name": 300, "col:type": 70 });
    expect(template).toBe("28px 300px 70px");
  });

  it("ignores saved widths for columns it isn't given and never goes below the 900px floor", () => {
    const { template, minWidth } = buildGridTemplate(["name"], { "col:type": 500 });
    expect(template).toBe("28px minmax(160px,1.6fr)");
    expect(minWidth).toBe(900);
  });

  it("grows the table's minimum width as columns are widened", () => {
    const { minWidth } = buildGridTemplate(ALL, { "col:name": 700, "col:specialties": 400 });
    expect(minWidth).toBe(40 + 28 + 88 + 700 + 110 + 120 + 400 + 110 + 92 + 84 + 62);
  });
});
