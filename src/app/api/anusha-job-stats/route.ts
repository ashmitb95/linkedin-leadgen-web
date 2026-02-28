import { NextResponse } from "next/server";
import { anushaJobsDb } from "@/lib/jobs";

export async function GET() {
  const stats = await anushaJobsDb.getJobStats();
  return NextResponse.json(stats);
}
