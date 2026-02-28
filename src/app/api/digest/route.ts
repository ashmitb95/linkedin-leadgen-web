import { NextRequest, NextResponse } from "next/server";
import { getLeadDigest } from "@/lib/leads";

export async function GET(request: NextRequest) {
  const date = new URL(request.url).searchParams.get("date") || undefined;
  const digest = await getLeadDigest(date);
  return NextResponse.json({ digest });
}
