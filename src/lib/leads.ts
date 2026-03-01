import { getDb } from "./db";
import type { Lead, LeadFilters, LeadStats, Run } from "./schema";

export async function getLeads(filters: LeadFilters): Promise<Lead[]> {
  const db = getDb();
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (filters.status) {
    conditions.push("status = ?");
    args.push(filters.status);
  }
  if (filters.tier) {
    conditions.push("tier = ?");
    args.push(filters.tier);
  }
  if (filters.type === "tech") {
    conditions.push("tier IN (1, 2, 3)");
  } else if (filters.type === "branding") {
    conditions.push("tier = 4");
  }
  if (filters.source === "salesnav") {
    conditions.push("keyword_match LIKE '[SN]%'");
  } else if (filters.source === "content") {
    conditions.push("(keyword_match NOT LIKE '[SN]%' OR keyword_match IS NULL)");
  }
  if (filters.urgency) {
    conditions.push("urgency = ?");
    args.push(filters.urgency);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  const orderBy =
    filters.sort === "relevance"
      ? "ORDER BY relevance DESC, found_at DESC"
      : "ORDER BY found_at DESC, relevance DESC";

  const result = await db.execute({
    sql: `SELECT * FROM leads ${where} ${orderBy} LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  return result.rows as unknown as Lead[];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM leads WHERE id = ?",
    args: [id],
  });
  return (result.rows[0] as unknown as Lead) || null;
}

export async function updateLead(
  id: string,
  updates: Record<string, string | number | null>
): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const args: (string | number | null)[] = [];

  for (const [field, value] of Object.entries(updates)) {
    setClauses.push(`${field} = ?`);
    args.push(value);
  }

  setClauses.push("updated_at = ?");
  args.push(now);
  args.push(id);

  const result = await db.execute({
    sql: `UPDATE leads SET ${setClauses.join(", ")} WHERE id = ?`,
    args,
  });
  return result.rowsAffected > 0;
}

export async function updateLeadStatus(id: string, status: string): Promise<boolean> {
  return updateLead(id, { status });
}

export async function getLeadStats(): Promise<LeadStats> {
  const db = getDb();

  const [totalRes, byStatusRes, byTierRes, byUrgencyRes, runsRes, todayRes] =
    await Promise.all([
      db.execute("SELECT COUNT(*) as c FROM leads"),
      db.execute("SELECT status, COUNT(*) as c FROM leads GROUP BY status"),
      db.execute("SELECT tier, COUNT(*) as count FROM leads GROUP BY tier ORDER BY tier"),
      db.execute("SELECT urgency, COUNT(*) as count FROM leads GROUP BY urgency"),
      db.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 10"),
      db.execute({
        sql: "SELECT COUNT(*) as c FROM leads WHERE found_at >= ?",
        args: [new Date().toISOString().split("T")[0]],
      }),
    ]);

  const statusMap: Record<string, number> = {};
  for (const row of byStatusRes.rows) {
    statusMap[row.status as string] = row.c as number;
  }

  return {
    total_leads: totalRes.rows[0].c as number,
    new_leads: statusMap["new"] || 0,
    message_sent: statusMap["message_sent"] || 0,
    reply_received: statusMap["reply_received"] || 0,
    meeting_booked: statusMap["meeting_booked"] || 0,
    client_converted: statusMap["client_converted"] || 0,
    client_churned: statusMap["client_churned"] || 0,
    invalid: statusMap["invalid"] || 0,
    by_tier: byTierRes.rows as unknown as { tier: number; count: number }[],
    by_urgency: byUrgencyRes.rows as unknown as { urgency: string; count: number }[],
    recent_runs: runsRes.rows as unknown as Run[],
    today_new: todayRes.rows[0].c as number,
  };
}

export async function getRuns(): Promise<Run[]> {
  const db = getDb();
  const result = await db.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 20");
  return result.rows as unknown as Run[];
}

export async function getLeadDigest(date?: string): Promise<string> {
  const db = getDb();
  const targetDate = date || new Date().toISOString().split("T")[0];

  const [leadsRes, runRes, statsRes] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM leads WHERE found_at >= ? AND found_at < date(?, '+1 day') ORDER BY relevance DESC",
      args: [targetDate, targetDate],
    }),
    db.execute({
      sql: "SELECT * FROM runs WHERE started_at >= ? ORDER BY id DESC LIMIT 1",
      args: [targetDate],
    }),
    getLeadStats(),
  ]);

  const leads = leadsRes.rows as unknown as Lead[];
  const latestRun = runRes.rows[0] as unknown as
    | { searches_run: number; leads_found: number; leads_new: number }
    | undefined;

  const highUrgency = leads.filter((l) => l.urgency === "high");
  const mediumUrgency = leads.filter((l) => l.urgency === "medium");
  const lowUrgency = leads.filter((l) => l.urgency === "low");
  const tierCounts = [1, 2, 3, 4].map((t) => leads.filter((l) => l.tier === t).length);

  let md = `## LinkedIn Lead Gen Report — ${targetDate}\n\n`;
  md += `### Run Summary\n`;
  md += `- Searches run: ${latestRun?.searches_run ?? "N/A"}\n`;
  md += `- Leads found: ${leads.length}\n`;
  md += `- New leads: ${latestRun?.leads_new ?? leads.length}\n`;
  md += `- High urgency: ${highUrgency.length}\n`;
  md += `- Tier breakdown: T1: ${tierCounts[0]} | T2: ${tierCounts[1]} | T3: ${tierCounts[2]} | T4: ${tierCounts[3]}\n\n`;

  md += `### Pipeline Totals\n`;
  md += `- Total leads: ${statsRes.total_leads}\n`;
  md += `- Triage: ${statsRes.new_leads} | Sent: ${statsRes.message_sent} | Replies: ${statsRes.reply_received} | Meetings: ${statsRes.meeting_booked} | Converted: ${statsRes.client_converted} | Invalid: ${statsRes.invalid}\n\n`;

  const formatEntry = (lead: Lead) => {
    const tierLabel =
      lead.tier === 1 ? "T1-Freelance" : lead.tier === 2 ? "T2-Product" : lead.tier === 3 ? "T3-AIScale" : "T4-Branding";
    const postSnippet = lead.post_content
      ? lead.post_content.slice(0, 120) + (lead.post_content.length > 120 ? "..." : "")
      : "N/A";
    let entry = `**${lead.name}**`;
    if (lead.company) entry += ` — ${lead.company}`;
    entry += `\n`;
    if (lead.headline) entry += `  ${lead.headline}\n`;
    entry += `  Post: "${postSnippet}"\n`;
    entry += `  ${tierLabel} | Relevance: ${Number(lead.relevance).toFixed(2)} | Urgency: ${lead.urgency}`;
    if (lead.post_date) entry += ` | Posted: ${lead.post_date}`;
    entry += `\n`;
    if (lead.contact_email) entry += `  Email: ${lead.contact_email}\n`;
    if (lead.contact_info) entry += `  Contact: ${lead.contact_info}\n`;
    if (lead.draft_message) entry += `  Draft: "${lead.draft_message.slice(0, 100)}..."\n`;
    if (lead.profile_url) entry += `  [Profile](${lead.profile_url})\n`;
    entry += `\n`;
    return entry;
  };

  if (highUrgency.length > 0) {
    md += `### High Priority Leads\n\n`;
    for (const lead of highUrgency) md += formatEntry(lead);
  }
  if (mediumUrgency.length > 0) {
    md += `### Medium Priority Leads\n\n`;
    for (const lead of mediumUrgency) md += formatEntry(lead);
  }
  if (lowUrgency.length > 0) {
    md += `### Other Leads\n\n`;
    for (const lead of lowUrgency) md += formatEntry(lead);
  }
  if (leads.length === 0) md += `*No new leads found today.*\n`;

  return md;
}
