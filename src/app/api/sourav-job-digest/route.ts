import { NextRequest, NextResponse } from "next/server";
import { souravJobsDb } from "@/lib/jobs";

export async function GET(request: NextRequest) {
  const date = new URL(request.url).searchParams.get("date") || undefined;
  const digest = await souravJobsDb.getJobDigest(date);
  return NextResponse.json({ digest });
}
