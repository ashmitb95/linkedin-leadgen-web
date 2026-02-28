import { NextResponse } from "next/server";
import { jobsDb } from "@/lib/jobs";

export async function GET() {
  const stats = await jobsDb.getJobStats();
  return NextResponse.json(stats);
}
