import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentActor } from "@/lib/actor";
import { canEditValueLists } from "@/lib/rbac";
import { buildMedicationTemplate } from "@/data/medicationImport";

// Not covered by proxy.ts (it skips /api), so this route checks the session
// and permission itself — same as the member template.
export async function GET(request: NextRequest) {
  let actor;
  try {
    actor = await getCurrentActor();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEditValueLists(actor)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const buffer = await buildMedicationTemplate(format);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nomad-medication-import-template.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
