import { NextResponse } from "next/server";
import { tanmayJobsDb } from "@/lib/jobs";

export async function GET() {
  const stats = await tanmayJobsDb.getJobStats();
  return NextResponse.json(stats);
}
