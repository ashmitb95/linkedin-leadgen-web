import { NextRequest, NextResponse } from "next/server";
import { souravJobsDb } from "@/lib/jobs";
import { generateJobHtmlReport } from "@/lib/export-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const work_mode = searchParams.get("work_mode") || undefined;
  const urgency = searchParams.get("urgency") || undefined;

  const jobs = await souravJobsDb.getJobs({ status, work_mode, urgency, limit: 1000, offset: 0 });
  const html = generateJobHtmlReport(jobs, "Sourav — Job Search Report");

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="sourav-job-report-${new Date().toISOString().slice(0, 10)}.html"`,
    },
  });
}
