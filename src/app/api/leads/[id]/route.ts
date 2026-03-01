import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "new", "message_sent", "reply_received",
  "meeting_booked", "client_converted", "client_churned", "invalid",
];
const VALID_URGENCIES = ["high", "medium", "low"];
const UPDATABLE_FIELDS = ["status", "urgency", "contact_email", "contact_info"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, string> = {};

  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      const value = body[field];

      if (field === "status" && !VALID_STATUSES.includes(value)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      if (field === "urgency" && !VALID_URGENCIES.includes(value)) {
        return NextResponse.json(
          { error: `Invalid urgency. Must be one of: ${VALID_URGENCIES.join(", ")}` },
          { status: 400 }
        );
      }

      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await updateLead(id, updates);
  if (!updated) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
