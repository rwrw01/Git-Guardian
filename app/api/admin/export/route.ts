import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../src/auth";
import { getScanReport } from "../../../../src/scan-store";
import { renderReportHtml } from "../../../../src/reporter";
import { logAudit } from "../../../../src/audit-log";

export const runtime = "nodejs";

/**
 * GET: export a scan report as HTML or JSON
 */
export async function GET(request: NextRequest) {
  const actor = await requireAdmin();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const format = searchParams.get("format") ?? "json";

  if (!id) {
    return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
  }

  const report = await getScanReport(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  await logAudit(actor, "EXPORT", id, `Exported report ${id} as ${format}`);

  if (format === "html") {
    const html = renderReportHtml(report);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="scan-report-${report.githubUsername}-${report.scannedAt.slice(0, 10)}.html"`,
      },
    });
  }

  // JSON export
  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="scan-report-${report.githubUsername}-${report.scannedAt.slice(0, 10)}.json"`,
    },
  });
}
