import { NextRequest, NextResponse } from "next/server";
import { tanmayJobsDb } from "@/lib/jobs";

export async function GET(request: NextRequest) {
  const date = new URL(request.url).searchParams.get("date") || undefined;
  const digest = await tanmayJobsDb.getJobDigest(date);
  return NextResponse.json({ digest });
}
