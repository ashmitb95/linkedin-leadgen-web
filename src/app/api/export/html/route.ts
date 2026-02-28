import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/leads";
import { generateLeadHtmlReport } from "@/lib/export-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const tier = searchParams.get("tier") ? Number(searchParams.get("tier")) : undefined;
  const urgency = searchParams.get("urgency") || undefined;

  const leads = await getLeads({ status, tier, urgency, limit: 1000, offset: 0 });
  const html = generateLeadHtmlReport(leads);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="lead-report-${new Date().toISOString().slice(0, 10)}.html"`,
    },
  });
}
