import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLeadStatus } from "@/lib/leads";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const validStatuses = ["new", "contacted", "replied", "archived"];

  if (!body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await updateLeadStatus(id, body.status);
  if (!updated) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
