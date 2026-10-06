import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentMember } from "@/lib/memberAuth";
import { fileForMember, fileResponse } from "@/data/files";

/** A member opens a document they uploaded (e.g. to check the photo). */
export async function GET(_request: Request, ctx: RouteContext<"/api/m/files/[id]">) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "signedOut" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  const file = id.success ? await fileForMember(id.data, member.id) : null;
  if (!file) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return fileResponse(file);
}
