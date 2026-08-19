import "server-only";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/actor";
import { canViewReports } from "@/lib/rbac";
import { listProviderReportRows } from "@/data/reports";
import { buildProviderReportWorkbook } from "@/lib/reports/providerReportWorkbook";

// Not covered by proxy.ts (it explicitly skips /api — see that file's
// matcher comment), so this route does its own auth + permission check
// rather than relying on the page-level redirect every other route in this
// app gets for free.
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

  const rows = await listProviderReportRows();
  const buffer = await buildProviderReportWorkbook(rows);
  const fileName = `provider-main-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // This report is "the data as of right now" by definition — a cached
      // download (browser or intermediary) would silently hand back stale
      // data on a repeat click with no visible sign it happened (found this
      // exact bug while testing: a second download after new columns were
      // added served the old file, with zero request even reaching this route).
      "Cache-Control": "no-store",
    },
  });
}
