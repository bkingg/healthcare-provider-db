import { describe, expect, it } from "vitest";
import { REFERENCE_LIST_GROUPS, REFERENCE_LIST_KEYS } from "@/lib/referenceListDefs";

describe("Value lists menu groups", () => {
  it("puts every list in exactly one group, so none goes missing from the menu", () => {
    const grouped = REFERENCE_LIST_GROUPS.flatMap((g) => g.lists as readonly string[]);
    expect([...grouped].sort()).toEqual([...REFERENCE_LIST_KEYS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});
