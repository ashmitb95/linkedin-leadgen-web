import { NextResponse } from "next/server";
import { getLeadStats } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getLeadStats();
  return NextResponse.json(stats);
}
