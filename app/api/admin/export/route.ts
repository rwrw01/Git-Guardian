import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "../../../../src/auth";
import { getScanReport } from "../../../../src/scan-store";
import { renderReportHtml } from "../../../../src/reporter";
import { logAudit } from "../../../../src/audit-log";

export const runtime = "nodejs";

async function getSession(request: NextRequest) {
  // @ts-expect-error — NextAuth v5 beta typing
  return auth(request);
}

/**
 * GET: export a scan report as HTML or JSON
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const actor = (session.user as Record<string, unknown>).githubUsername as string ?? "unknown";
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
