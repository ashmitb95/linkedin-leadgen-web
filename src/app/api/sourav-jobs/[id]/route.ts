import { NextRequest, NextResponse } from "next/server";
import { souravJobsDb } from "@/lib/jobs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await souravJobsDb.getJobById(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const validStatuses = ["new", "saved", "applied", "interviewing", "offer", "rejected", "archived"];

  if (body.notes !== undefined) {
    const updated = await souravJobsDb.updateJobNotes(id, body.notes);
    if (!updated) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (!body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await souravJobsDb.updateJobStatus(id, body.status);
  if (!updated) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
