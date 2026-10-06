/** What an uploaded file really is, from its first bytes — never trusting
 * the name or the browser's claimed type. Only what we accept for
 * documents: JPEG, PNG, WebP, HEIC (iPhone photos) and PDF. */
export type AcceptedType = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf";

const startsWith = (b: Uint8Array, bytes: number[], at = 0) => bytes.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

export function detectFileType(b: Uint8Array): AcceptedType | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(b, 4, 8) === "ftyp" && ["heic", "heix", "mif1", "msf1", "heim", "heis"].includes(ascii(b, 8, 12))) return "image/heic";
  return null;
}

export const EXTENSION: Record<AcceptedType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};
