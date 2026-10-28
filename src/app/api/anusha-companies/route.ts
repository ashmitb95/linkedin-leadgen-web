import { NextResponse } from "next/server";
import { listCompanies } from "@/lib/anusha-companies";

export async function GET() {
  return NextResponse.json(await listCompanies());
}
