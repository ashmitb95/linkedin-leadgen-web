import { getDb } from "./db";
import type { Job, JobFilters, JobStats, JobRun } from "./schema";

function createJobQueries(tableName: string, runTableName: string) {
  async function getJobs(filters: JobFilters): Promise<Job[]> {
    const db = getDb();
    const clauses: string[] = [];
    const args: (string | number)[] = [];

    if (filters.status) { clauses.push("status = ?"); args.push(filters.status); }
    if (filters.work_mode) { clauses.push("work_mode = ?"); args.push(filters.work_mode); }
    if (filters.urgency) { clauses.push("urgency = ?"); args.push(filters.urgency); }
    if (filters.min_fit) { clauses.push("fit_score >= ?"); args.push(filters.min_fit); }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const orderBy =
      filters.sort === "recent"
        ? "ORDER BY found_at DESC, fit_score DESC"
        : "ORDER BY fit_score DESC, found_at DESC";

    const result = await db.execute({
      sql: `SELECT * FROM ${tableName} ${where} ${orderBy} LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    return result.rows as unknown as Job[];
  }

  async function getJobById(id: string): Promise<Job | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM ${tableName} WHERE id = ?`,
      args: [id],
    });
    return (result.rows[0] as unknown as Job) || null;
  }

  async function updateJobStatus(id: string, status: string): Promise<boolean> {
    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `UPDATE ${tableName} SET status = ?, updated_at = ? WHERE id = ?`,
      args: [status, now, id],
    });
    return result.rowsAffected > 0;
  }

  async function updateJobNotes(id: string, notes: string): Promise<boolean> {
    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `UPDATE ${tableName} SET notes = ?, updated_at = ? WHERE id = ?`,
      args: [notes, now, id],
    });
    return result.rowsAffected > 0;
  }

  async function getJobStats(): Promise<JobStats> {
    const db = getDb();

    const [totalRes, byStatusRes, byWorkModeRes, bySeniorityRes, runsRes, todayRes] =
      await Promise.all([
        db.execute(`SELECT COUNT(*) as c FROM ${tableName}`),
        db.execute(`SELECT status, COUNT(*) as count FROM ${tableName} GROUP BY status`),
        db.execute(`SELECT work_mode, COUNT(*) as count FROM ${tableName} GROUP BY work_mode`),
        db.execute(`SELECT seniority_match, COUNT(*) as count FROM ${tableName} GROUP BY seniority_match`),
        db.execute(`SELECT * FROM ${runTableName} ORDER BY id DESC LIMIT 10`),
        db.execute({
          sql: `SELECT COUNT(*) as c FROM ${tableName} WHERE found_at >= ? AND found_at < ?`,
          args: [
            new Date().toISOString().slice(0, 10) + "T00:00:00",
            new Date().toISOString().slice(0, 10) + "T23:59:59",
          ],
        }),
      ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatusRes.rows) statusMap[s.status as string] = s.count as number;

    return {
      total_jobs: totalRes.rows[0].c as number,
      new_jobs: statusMap["new"] || 0,
      saved: statusMap["saved"] || 0,
      applied: statusMap["applied"] || 0,
      interviewing: statusMap["interviewing"] || 0,
      offer: statusMap["offer"] || 0,
      rejected: statusMap["rejected"] || 0,
      archived: statusMap["archived"] || 0,
      by_work_mode: byWorkModeRes.rows as unknown as { work_mode: string; count: number }[],
      by_seniority: bySeniorityRes.rows as unknown as { seniority_match: string; count: number }[],
      recent_runs: runsRes.rows as unknown as JobRun[],
      today_new: todayRes.rows[0].c as number,
    };
  }

  async function getJobDigest(date?: string): Promise<string> {
    const db = getDb();
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const [jobsRes, runRes, totalRes, statusRes] = await Promise.all([
      db.execute({
        sql: `SELECT * FROM ${tableName} WHERE found_at >= ? AND found_at < ? ORDER BY fit_score DESC`,
        args: [targetDate + "T00:00:00", targetDate + "T23:59:59"],
      }),
      db.execute({
        sql: `SELECT * FROM ${runTableName} WHERE started_at >= ? ORDER BY id DESC LIMIT 1`,
        args: [targetDate + "T00:00:00"],
      }),
      db.execute(`SELECT COUNT(*) as total FROM ${tableName}`),
      db.execute(`SELECT status, COUNT(*) as count FROM ${tableName} GROUP BY status`),
    ]);

    const dayJobs = jobsRes.rows as unknown as Job[];
    const latestRun = runRes.rows[0] as unknown as { searches_run: number; jobs_new: number } | undefined;
    const statusMap: Record<string, number> = {};
    for (const s of statusRes.rows) statusMap[s.status as string] = s.count as number;

    const highFit = dayJobs.filter((j) => j.fit_score >= 0.7);
    const remote = dayJobs.filter((j) => j.work_mode === "remote");
    const exact = dayJobs.filter((j) => j.seniority_match === "exact");

    let digest = `## Job Search Report — ${targetDate}\n\n`;
    digest += `### Run Summary\n`;
    digest += `- Searches run: ${latestRun?.searches_run ?? 0}\n`;
    digest += `- Jobs found: ${dayJobs.length}\n`;
    digest += `- New jobs: ${latestRun?.jobs_new ?? 0}\n`;
    digest += `- High fit (70%+): ${highFit.length}\n`;
    digest += `- Remote: ${remote.length}\n`;
    digest += `- Exact seniority match: ${exact.length}\n\n`;

    digest += `### Pipeline Totals\n`;
    digest += `- Total jobs: ${totalRes.rows[0].total as number}\n`;
    digest += `- New: ${statusMap["new"] || 0} | Saved: ${statusMap["saved"] || 0} | Applied: ${statusMap["applied"] || 0}`;
    digest += ` | Interviewing: ${statusMap["interviewing"] || 0} | Offer: ${statusMap["offer"] || 0}`;
    digest += ` | Rejected: ${statusMap["rejected"] || 0} | Archived: ${statusMap["archived"] || 0}\n\n`;

    if (highFit.length > 0) {
      digest += `### Top Matches\n\n`;
      for (const j of highFit.slice(0, 10)) {
        const fitPct = Math.round(j.fit_score * 100);
        const stackPct = Math.round(j.stack_match * 100);
        digest += `**${j.title}** — ${j.company || "Unknown"}\n`;
        digest += `  ${j.location || "Location N/A"} | ${j.work_mode} | Seniority: ${j.seniority_match}\n`;
        if (j.job_description) digest += `  ${j.job_description.slice(0, 120)}...\n`;
        digest += `  Fit: ${fitPct}% | Stack: ${stackPct}% | Urgency: ${j.urgency}\n`;
        if (j.draft_message) digest += `  Draft: "${j.draft_message.slice(0, 100)}..."\n`;
        if (j.job_url) digest += `  [Job Listing](${j.job_url})\n`;
        if (j.poster_url) digest += `  [Posted by ${j.poster_name}](${j.poster_url})\n`;
        digest += `\n`;
      }
    }

    const mediumFit = dayJobs.filter((j) => j.fit_score >= 0.4 && j.fit_score < 0.7);
    if (mediumFit.length > 0) {
      digest += `### Other Matches (${mediumFit.length})\n\n`;
      for (const j of mediumFit.slice(0, 5)) {
        digest += `**${j.title}** — ${j.company || "Unknown"} | ${j.work_mode} | Fit: ${Math.round(j.fit_score * 100)}%\n`;
      }
      digest += `\n`;
    }

    if (dayJobs.length === 0) digest += `*No new jobs found today.*\n`;

    return digest;
  }

  return { getJobs, getJobById, updateJobStatus, updateJobNotes, getJobStats, getJobDigest };
}

export const jobsDb = createJobQueries("jobs", "job_runs");
export const anushaJobsDb = createJobQueries("anusha_jobs", "anusha_job_runs");
export const souravJobsDb = createJobQueries("sourav_jobs", "sourav_job_runs");
