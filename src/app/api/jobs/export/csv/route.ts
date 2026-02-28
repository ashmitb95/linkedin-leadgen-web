import { NextRequest, NextResponse } from "next/server";
import { jobsDb } from "@/lib/jobs";
import { generateJobCsv } from "@/lib/export-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const work_mode = searchParams.get("work_mode") || undefined;
  const urgency = searchParams.get("urgency") || undefined;

  const jobs = await jobsDb.getJobs({ status, work_mode, urgency, limit: 1000, offset: 0 });
  const csv = generateJobCsv(jobs);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="jobs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
