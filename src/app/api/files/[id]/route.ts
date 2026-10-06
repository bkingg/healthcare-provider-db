import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentActor } from "@/lib/actor";
import { canWorkCases } from "@/lib/rbac";
import { fileForStaff, fileResponse } from "@/data/files";

/** Staff who work cases open a document attached to a medication order. */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[id]">) {
  let actor;
  try {
    actor = await getCurrentActor();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canWorkCases(actor)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const id = z.uuid().safeParse((await ctx.params).id);
  const file = id.success ? await fileForStaff(id.data) : null;
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return fileResponse(file);
}
