import { NextRequest, NextResponse } from "next/server";
import { OUTREACH_STATUSES, setOutreach, type OutreachStatus } from "@/lib/anusha-companies";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const body = await request.json();

  if (body.status !== null && !OUTREACH_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be null or one of: ${OUTREACH_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }
  if (body.notes !== undefined && typeof body.notes !== "string") {
    return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
  }

  const ok = await setOutreach(contactId, { status: body.status as OutreachStatus | null, notes: body.notes });
  if (!ok) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
