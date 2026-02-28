import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/leads";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const tier = searchParams.get("tier") ? Number(searchParams.get("tier")) : undefined;
  const urgency = searchParams.get("urgency") || undefined;
  const sort = (searchParams.get("sort") === "relevance" ? "relevance" : "recent") as "recent" | "relevance";
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 100;
  const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : 0;

  const leads = await getLeads({ status, tier, urgency, sort, limit, offset });
  return NextResponse.json({ leads, count: leads.length });
}
