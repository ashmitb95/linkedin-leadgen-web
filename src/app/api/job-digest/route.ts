import { NextRequest, NextResponse } from "next/server";
import { jobsDb } from "@/lib/jobs";

export async function GET(request: NextRequest) {
  const date = new URL(request.url).searchParams.get("date") || undefined;
  const digest = await jobsDb.getJobDigest(date);
  return NextResponse.json({ digest });
}
