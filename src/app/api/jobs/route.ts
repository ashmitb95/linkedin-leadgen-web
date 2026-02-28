import { NextRequest, NextResponse } from "next/server";
import { jobsDb } from "@/lib/jobs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const work_mode = searchParams.get("work_mode") || undefined;
  const urgency = searchParams.get("urgency") || undefined;
  const min_fit = searchParams.get("min_fit") ? Number(searchParams.get("min_fit")) : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 100;
  const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : 0;

  const jobs = await jobsDb.getJobs({ status, work_mode, urgency, min_fit, limit, offset });
  return NextResponse.json({ jobs, count: jobs.length });
}
