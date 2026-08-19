import "server-only";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/actor";
import { canViewReports } from "@/lib/rbac";
import { listAdministrativeContactReportRows } from "@/data/reports";
import { buildAdminContactReportWorkbook } from "@/lib/reports/adminContactReportWorkbook";

// Same auth as the provider main report route: /api is skipped by proxy.ts,
// so the route checks the session and the report permission itself.
export async function GET() {
  let actor;
  try {
    actor = await getCurrentActor();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canViewReports(actor)) {
    return NextResponse.json({ error: "Not authorized to view reports" }, { status: 403 });
  }

  const rows = await listAdministrativeContactReportRows();
  const buffer = await buildAdminContactReportWorkbook(rows);
  const fileName = `administrative-contacts-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // "The data as of right now" — never serve a cached copy.
      "Cache-Control": "no-store",
    },
  });
}
