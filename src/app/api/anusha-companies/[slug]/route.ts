import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/anusha-companies";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getCompany(slug);
  if (!result) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json(result);
}
