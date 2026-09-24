import { beforeEach, describe, expect, it, vi } from "vitest";

// The store is module-level state that hydrates from localStorage once, so
// each test gets a fresh copy of the module.
async function loadStore() {
  vi.resetModules();
  return import("@/lib/panel-widths");
}

beforeEach(() => window.localStorage.clear());

describe("clampWidth", () => {
  it("keeps each kind of panel within its limits", async () => {
    const { clampWidth } = await loadStore();
    expect(clampWidth("nav", 50)).toBe(200);
    expect(clampWidth("nav", 9999)).toBe(420);
    expect(clampWidth("filters", 300.4)).toBe(300);
    expect(clampWidth("col:name", 10)).toBe(48);
    expect(clampWidth("col:name", 5000)).toBe(800);
  });
});

describe("panel width store", () => {
  it("only writes to localStorage when persisted, not on every drag update", async () => {
    const { setPanelWidth, persistPanelWidths } = await loadStore();
    setPanelWidth("nav", 300);
    expect(window.localStorage.getItem("pn-panel-widths")).toBeNull();
    persistPanelWidths();
    expect(JSON.parse(window.localStorage.getItem("pn-panel-widths")!)).toEqual({ nav: 300 });
  });

  it("restores saved widths, dropping unknown keys and re-clamping out-of-range values", async () => {
    window.localStorage.setItem("pn-panel-widths", JSON.stringify({ nav: 5000, "col:type": 150, bogus: 3, filters: "wide" }));
    const { setPanelWidth, persistPanelWidths } = await loadStore();
    setPanelWidth("filters", 250);
    persistPanelWidths();
    expect(JSON.parse(window.localStorage.getItem("pn-panel-widths")!)).toEqual({ nav: 420, "col:type": 150, filters: 250 });
  });

  it("resets only the matching keys", async () => {
    const { setPanelWidth, resetPanelWidths } = await loadStore();
    setPanelWidth("nav", 300);
    setPanelWidth("col:name", 200);
    setPanelWidth("col:type", 100);
    resetPanelWidths((k) => k.startsWith("col:"));
    expect(JSON.parse(window.localStorage.getItem("pn-panel-widths")!)).toEqual({ nav: 300 });
  });

  it("survives corrupt storage", async () => {
    window.localStorage.setItem("pn-panel-widths", "{not json");
    const { setPanelWidth, persistPanelWidths } = await loadStore();
    setPanelWidth("nav", 260);
    persistPanelWidths();
    expect(JSON.parse(window.localStorage.getItem("pn-panel-widths")!)).toEqual({ nav: 260 });
  });
});
