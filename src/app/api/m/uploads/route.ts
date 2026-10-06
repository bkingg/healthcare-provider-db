import "server-only";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/memberAuth";
import { saveUpload, UploadRejectedError } from "@/data/files";

/** A member uploads one document (a prescription photo, an ID…), on its own,
 * as soon as it's chosen — the order then refers to it by id. Photos are
 * shrunk on the phone before they're sent. Not covered by proxy.ts (it
 * skips /api), so the session is checked here. */
export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "signedOut" }, { status: 401 });
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    file = null;
  }
  if (!file) return NextResponse.json({ error: "empty" }, { status: 400 });
  try {
    const saved = await saveUpload(new Uint8Array(await file.arrayBuffer()), file.name, { memberId: member.id });
    return NextResponse.json({ id: saved.id, name: saved.originalName, contentType: saved.contentType, size: saved.sizeBytes });
  } catch (err) {
    if (err instanceof UploadRejectedError) return NextResponse.json({ error: err.code }, { status: err.code === "tooMany" ? 429 : 400 });
    throw err;
  }
}
