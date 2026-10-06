import { describe, expect, it } from "vitest";
import { detectFileType } from "../fileTypes";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("detectFileType", () => {
  it("recognises what we accept by content", () => {
    expect(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectFileType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectFileType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("image/webp");
    expect(detectFileType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(detectFileType(bytes([0, 0, 0, 24], "ftypheic"))).toBe("image/heic");
  });
  it("rejects anything else, whatever it's called", () => {
    expect(detectFileType(bytes("<html>"))).toBeNull();
    expect(detectFileType(bytes("MZ"))).toBeNull();
    expect(detectFileType(bytes([]))).toBeNull();
  });
});
