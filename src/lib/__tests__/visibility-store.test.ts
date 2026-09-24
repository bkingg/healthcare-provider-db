import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createVisibilityStore, moveKey } from "@/lib/visibility-store";

const KEYS = ["a", "b", "c", "d"] as const;
type Key = (typeof KEYS)[number];
const REVERSED: readonly Key[] = ["d", "c", "b", "a"];

beforeEach(() => window.localStorage.clear());

describe("moveKey", () => {
  it("moves a key up or down to the given index", () => {
    expect(moveKey(KEYS, "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveKey(KEYS, "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveKey(KEYS, "b", 1)).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps out-of-range indexes and ignores unknown keys", () => {
    expect(moveKey(KEYS, "a", 99)).toEqual(["b", "c", "d", "a"]);
    expect(moveKey(KEYS, "d", -5)).toEqual(["d", "a", "b", "c"]);
    expect(moveKey(KEYS, "z" as Key, 0)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("createVisibilityStore", () => {
  it("shows everything in the default order by default", () => {
    const { result } = renderHook(() => createVisibilityStore("test-default", KEYS)());
    expect([...result.current.visible]).toEqual(["a", "b", "c", "d"]);
    expect(result.current.order).toEqual(["a", "b", "c", "d"]);
    expect(result.current.customOrder).toBeNull();
  });

  it("toggles, persists, and resets", () => {
    const { result } = renderHook(createVisibilityStore("test-toggle", KEYS));
    act(() => result.current.toggle("b"));
    expect(result.current.visible.has("b")).toBe(false);
    expect(JSON.parse(window.localStorage.getItem("test-toggle")!)).toEqual({ order: null, hidden: ["b"] });
    act(() => result.current.reset());
    expect(result.current.visible.size).toBe(4);
  });

  it("keeps the caller's default order until the user reorders, then starts from it", () => {
    const useVis = createVisibilityStore("test-order", KEYS);
    const { result } = renderHook(() => useVis(REVERSED));
    expect(result.current.order).toEqual(REVERSED);
    act(() => result.current.move("a", 0));
    expect(result.current.order).toEqual(["a", "d", "c", "b"]);
    expect(result.current.customOrder).toEqual(["a", "d", "c", "b"]);
    expect(JSON.parse(window.localStorage.getItem("test-order")!).order).toEqual(["a", "d", "c", "b"]);
    act(() => result.current.reset());
    expect(result.current.order).toEqual(REVERSED);
  });

  it("reads the original format (a plain list of visible keys)", () => {
    window.localStorage.setItem("test-legacy", JSON.stringify(["c", "gone", "a"]));
    const { result } = renderHook(createVisibilityStore("test-legacy", KEYS));
    expect([...result.current.visible]).toEqual(["a", "c"]);
    expect(result.current.customOrder).toBeNull();
  });

  it("sanitizes a saved order: drops unknown/duplicate keys, appends keys added since", () => {
    window.localStorage.setItem("test-sanitize", JSON.stringify({ order: ["c", "gone", "a", "c"], hidden: ["b", "nope"] }));
    const { result } = renderHook(createVisibilityStore("test-sanitize", KEYS));
    expect(result.current.order).toEqual(["c", "a", "b", "d"]);
    expect([...result.current.visible]).toEqual(["a", "c", "d"]);
  });

  it("falls back to the default on corrupt storage", () => {
    window.localStorage.setItem("test-corrupt", "{nope");
    const { result } = renderHook(createVisibilityStore("test-corrupt", KEYS));
    expect(result.current.visible.size).toBe(4);
    expect(result.current.customOrder).toBeNull();
  });
});
