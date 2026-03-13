import { NextResponse } from "next/server";
import { souravJobsDb } from "@/lib/jobs";

export async function GET() {
  const stats = await souravJobsDb.getJobStats();
  return NextResponse.json(stats);
}
