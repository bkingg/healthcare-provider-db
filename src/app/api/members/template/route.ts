import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentActor } from "@/lib/actor";
import { canManageMembers } from "@/lib/rbac";
import { buildMemberTemplate } from "@/data/memberImport";

// Not covered by proxy.ts (it skips /api), so this route checks the session
// and permission itself — same as the report downloads.
export async function GET(request: NextRequest) {
  let actor;
  try {
    actor = await getCurrentActor();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canManageMembers(actor)) return NextResponse.json({ error: "Not authorized to manage members" }, { status: 403 });

  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const buffer = await buildMemberTemplate(format);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nomad-member-import-template.${format}"`,
      // The Codes sheet reflects today's value lists — never serve a stale copy.
      "Cache-Control": "no-store",
    },
  });
}
