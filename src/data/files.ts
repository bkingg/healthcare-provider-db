import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { putFile, readStoredFile } from "@/lib/storage";
import { detectFileType, EXTENSION } from "@/lib/fileTypes";

/** Uploaded documents (prescriptions, IDs): checked by content, stored
 * privately, recorded with who uploaded them. */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_MEMBER_UPLOADS_PER_HOUR = 30;

export class UploadRejectedError extends Error {
  constructor(public code: "empty" | "tooBig" | "type" | "tooMany") {
    super(code);
  }
}

export async function saveUpload(bytes: Uint8Array, originalName: string, by: { memberId: string } | { staffId: string }) {
  if (!bytes.length) throw new UploadRejectedError("empty");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadRejectedError("tooBig");
  const contentType = detectFileType(bytes);
  if (!contentType) throw new UploadRejectedError("type");
  if ("memberId" in by) {
    const recent = await prisma.storedFile.count({ where: { uploadedByMemberId: by.memberId, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
    if (recent >= MAX_MEMBER_UPLOADS_PER_HOUR) throw new UploadRejectedError("tooMany");
  }
  const now = new Date();
  const storageKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXTENSION[contentType]}`;
  await putFile(storageKey, bytes);
  return prisma.storedFile.create({
    data: {
      storageKey,
      originalName: originalName.slice(0, 200) || `upload.${EXTENSION[contentType]}`,
      contentType,
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      ...("memberId" in by ? { uploadedByMemberId: by.memberId } : { uploadedByStaffId: by.staffId }),
    },
  });
}

/** A member may open a file they uploaded. (Attached files are only theirs
 * to view — staff see them through the staff route.) */
export async function fileForMember(fileId: string, memberId: string) {
  return prisma.storedFile.findFirst({ where: { id: fileId, uploadedByMemberId: memberId } });
}

/** Staff may open any file attached to a medication order. */
export async function fileForStaff(fileId: string) {
  return prisma.storedFile.findFirst({ where: { id: fileId, medicationDocument: { isNot: null } } });
}

export async function fileResponse(file: { storageKey: string; contentType: string; originalName: string }) {
  const bytes = await readStoredFile(file.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
