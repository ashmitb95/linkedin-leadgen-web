import { getDb } from "./db";

import {
  FOLLOW_UP_DAYS,
  type CompanyDetail,
  type CompanyJob,
  type CompanySummary,
  type Contact,
  type ContactLabel,
  type OutreachStatus,
  type OutreachStats,
} from "./anusha-companies-shared";

export * from "./anusha-companies-shared";

const str = (v: unknown) => (v == null ? "" : String(v));

function followUpCutoff(): string {
  return new Date(Date.now() - FOLLOW_UP_DAYS * 86400000).toISOString();
}

export async function listCompanies(): Promise<{ companies: CompanySummary[]; stats: OutreachStats }> {
  const db = getDb();
  const [companies, counts, outreach] = await Promise.all([
    db.execute("SELECT slug, name, tier, cities, type, website, jobs FROM anusha_companies ORDER BY sort_order"),
    db.execute(`
      SELECT company_slug,
             SUM(CASE WHEN ai_label != 'not_relevant' THEN 1 ELSE 0 END) AS contacts,
             SUM(is_alumni) AS alumni
      FROM anusha_contacts GROUP BY company_slug
    `),
    db.execute(`
      SELECT c.company_slug, o.status, o.messaged_at
      FROM anusha_outreach o JOIN anusha_contacts c ON c.id = o.contact_id
    `),
  ]);

  const countBy = new Map(counts.rows.map((r) => [str(r.company_slug), r]));
  const progressBy = new Map<string, CompanySummary["progress"]>();
  const cutoff = followUpCutoff();
  const stats: OutreachStats = { reachedOut: 0, replied: 0, followUpsDue: 0 };

  for (const r of outreach.rows) {
    const slug = str(r.company_slug);
    const status = str(r.status);
    const replied = status === "replied" || status === "call";
    stats.reachedOut++;
    if (replied) stats.replied++;
    if (status === "messaged" && str(r.messaged_at) && str(r.messaged_at) < cutoff) stats.followUpsDue++;
    if (replied) progressBy.set(slug, "replied");
    else if (progressBy.get(slug) !== "replied") progressBy.set(slug, "started");
  }

  return {
    stats,
    companies: companies.rows.map((r) => {
      const slug = str(r.slug);
      const jobs: CompanyJob[] = JSON.parse(str(r.jobs) || "[]");
      const c = countBy.get(slug);
      return {
        slug,
        name: str(r.name),
        tier: Number(r.tier),
        cities: JSON.parse(str(r.cities) || "[]"),
        type: str(r.type),
        website: str(r.website),
        relevantJobs: jobs.filter((j) => j.relevant).length,
        contacts: Number(c?.contacts ?? 0),
        alumni: Number(c?.alumni ?? 0),
        progress: progressBy.get(slug) ?? "none",
      };
    }),
  };
}

export async function getCompany(slug: string): Promise<{ company: CompanyDetail; contacts: Contact[] } | null> {
  const db = getDb();
  const [companyRes, contactsRes] = await Promise.all([
    db.execute({ sql: "SELECT * FROM anusha_companies WHERE slug = ?", args: [slug] }),
    db.execute({
      sql: `SELECT c.*, o.status, o.status_at, o.messaged_at, o.notes
            FROM anusha_contacts c LEFT JOIN anusha_outreach o ON o.contact_id = c.id
            WHERE c.company_slug = ? ORDER BY c.ai_score DESC, c.name`,
      args: [slug],
    }),
  ]);
  const r = companyRes.rows[0];
  if (!r) return null;

  return {
    company: {
      slug: str(r.slug),
      name: str(r.name),
      tier: Number(r.tier),
      cities: JSON.parse(str(r.cities) || "[]"),
      type: str(r.type),
      website: str(r.website),
      hook: str(r.hook),
      teams: str(r.teams),
      linkedinUrl: str(r.linkedin_url),
      careersUrl: str(r.careers_url),
      industry: str(r.industry),
      size: str(r.size),
      headquarters: str(r.headquarters),
      jobsSearchUrl: str(r.jobs_search_url),
      jobs: JSON.parse(str(r.jobs) || "[]"),
    },
    contacts: contactsRes.rows.map((c) => ({
      id: str(c.id),
      name: str(c.name),
      headline: str(c.headline),
      currentRole: str(c.current_role),
      location: str(c.location),
      degree: str(c.degree),
      isAlumni: Number(c.is_alumni) === 1,
      profileUrl: str(c.profile_url),
      label: str(c.ai_label) as ContactLabel | "",
      score: Number(c.ai_score),
      reason: str(c.ai_reason),
      email: str(c.email),
      emailStatus: str(c.email_status) as Contact["emailStatus"],
      emailNote: str(c.email_note),
      outreach: c.status
        ? {
            status: str(c.status) as OutreachStatus,
            statusAt: str(c.status_at),
            messagedAt: str(c.messaged_at),
            notes: str(c.notes),
          }
        : null,
    })),
  };
}

/** Set (or clear, with status null) a contact's outreach status. Returns false if the contact doesn't exist. */
export async function setOutreach(
  contactId: string,
  update: { status: OutreachStatus | null; notes?: string },
): Promise<boolean> {
  const db = getDb();
  const exists = await db.execute({ sql: "SELECT 1 FROM anusha_contacts WHERE id = ?", args: [contactId] });
  if (!exists.rows.length) return false;

  if (update.status === null) {
    await db.execute({ sql: "DELETE FROM anusha_outreach WHERE contact_id = ?", args: [contactId] });
    return true;
  }

  const now = new Date().toISOString();
  // messaged_at is set on first "messaged" and kept through later statuses.
  await db.execute({
    sql: `INSERT INTO anusha_outreach (contact_id, status, status_at, messaged_at, notes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(contact_id) DO UPDATE SET
            status = excluded.status,
            status_at = excluded.status_at,
            messaged_at = CASE WHEN anusha_outreach.messaged_at = '' THEN excluded.messaged_at ELSE anusha_outreach.messaged_at END,
            notes = COALESCE(?, anusha_outreach.notes)`,
    args: [contactId, update.status, now, now, update.notes ?? "", update.notes ?? null],
  });
  return true;
}
