import { NextResponse } from "next/server";
import { getRuns } from "@/lib/leads";

export async function GET() {
  const runs = await getRuns();
  return NextResponse.json({ runs });
}
