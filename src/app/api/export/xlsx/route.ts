import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/leads";
import { generateLeadXlsx } from "@/lib/export-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const tier = searchParams.get("tier") ? Number(searchParams.get("tier")) : undefined;
  const urgency = searchParams.get("urgency") || undefined;

  const leads = await getLeads({ status, tier, urgency, sort: "recent", limit: 5000, offset: 0 });
  const buffer = await generateLeadXlsx(leads);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
