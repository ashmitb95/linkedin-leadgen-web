/**
 * db-ops.ts — Pipeline write operations (upsert, seen posts, run logging).
 *
 * Converts the original better-sqlite3 sync calls to async @libsql/client.
 * Reuses getDb() from src/lib/db.ts (Turso client).
 */

import { getDb } from "../db";
import crypto from "crypto";

// ───── Hashing ─────

export function hashProfileUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export function hashPostContent(profileUrl: string, cardText: string): string {
  const key = profileUrl + (cardText || "").slice(0, 300);
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

// ───── Seen Posts (dedup) ─────

export async function getSeenPostHashes(): Promise<Set<string>> {
  const db = getDb();
  const result = await db.execute("SELECT content_hash FROM seen_posts");
  return new Set(result.rows.map((r) => r.content_hash as string));
}

export async function markPostsSeen(
  posts: { contentHash: string; profileUrl: string }[]
): Promise<void> {
  if (posts.length === 0) return;
  const db = getDb();
  const now = new Date().toISOString();
  for (const p of posts) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO seen_posts (content_hash, profile_url, found_at) VALUES (?, ?, ?)",
      args: [p.contentHash, p.profileUrl, now],
    });
  }
}

// ───── Lead Upsert ─────

export interface UpsertLeadInput {
  name: string;
  headline: string;
  company: string;
  profile_url: string;
  public_profile_url?: string;
  post_content: string;
  post_url: string;
  keyword_match: string;
  tier: number;
  relevance: number;
  urgency: string;
  draft_message: string;
  found_at: string;
  contact_email?: string;
  contact_info?: string;
  post_date?: string;
}

export async function upsertLead(lead: UpsertLeadInput): Promise<{ isNew: boolean }> {
  const db = getDb();
  const id = hashProfileUrl(lead.profile_url);
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: "SELECT id FROM leads WHERE id = ?",
    args: [id],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE leads SET
        post_content = COALESCE(?, post_content),
        post_url = COALESCE(?, post_url),
        keyword_match = COALESCE(?, keyword_match),
        tier = ?,
        relevance = MAX(relevance, ?),
        urgency = ?,
        draft_message = COALESCE(?, draft_message),
        contact_email = COALESCE(NULLIF(?, ''), contact_email),
        contact_info = COALESCE(NULLIF(?, ''), contact_info),
        post_date = COALESCE(NULLIF(?, ''), post_date),
        public_profile_url = COALESCE(NULLIF(?, ''), public_profile_url),
        updated_at = ?
      WHERE id = ?`,
      args: [
        lead.post_content,
        lead.post_url,
        lead.keyword_match,
        lead.tier,
        lead.relevance,
        lead.urgency,
        lead.draft_message,
        lead.contact_email || "",
        lead.contact_info || "",
        lead.post_date || "",
        lead.public_profile_url || "",
        now,
        id,
      ],
    });
    return { isNew: false };
  }

  await db.execute({
    sql: `INSERT INTO leads (id, name, headline, company, profile_url, public_profile_url, post_content, post_url, keyword_match, tier, relevance, urgency, draft_message, status, found_at, updated_at, contact_email, contact_info, post_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
    args: [
      id,
      lead.name,
      lead.headline,
      lead.company,
      lead.profile_url,
      lead.public_profile_url || "",
      lead.post_content,
      lead.post_url,
      lead.keyword_match,
      lead.tier,
      lead.relevance,
      lead.urgency,
      lead.draft_message,
      lead.found_at,
      now,
      lead.contact_email || "",
      lead.contact_info || "",
      lead.post_date || "",
    ],
  });

  return { isNew: true };
}

// ───── Lead Run Logging ─────

export async function logRunStart(): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: "INSERT INTO runs (started_at, searches_run, leads_found, leads_new) VALUES (?, 0, 0, 0)",
    args: [now],
  });
  return Number(result.lastInsertRowid);
}

export async function logRunEnd(
  runId: number,
  stats: { searches_run: number; leads_found: number; leads_new: number }
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: "UPDATE runs SET completed_at = ?, searches_run = ?, leads_found = ?, leads_new = ? WHERE id = ?",
    args: [now, stats.searches_run, stats.leads_found, stats.leads_new, runId],
  });
}

// ───── Job Upsert (factory for multiple tables) ─────

export interface UpsertJobInput {
  dedup_key: string;
  source: string;
  title: string;
  company: string;
  location: string;
  work_mode: string;
  salary_range?: string | null;
  job_url: string;
  apply_url?: string;
  job_description: string;
  recruiter_name?: string;
  recruiter_email?: string;
  recruiter_url?: string;
  poster_name?: string;
  poster_headline?: string;
  poster_url?: string;
  post_content?: string;
  post_url?: string;
  fit_score: number;
  stack_match: number;
  seniority_match: string;
  urgency: string;
  reasoning?: string;
  draft_message?: string;
  keyword_match: string;
  found_at: string;
}

function createJobOps(tableName: string, runTableName: string) {
  async function upsertJob(job: UpsertJobInput): Promise<{ isNew: boolean }> {
    const db = getDb();
    const id = hashKey(job.dedup_key);
    const now = new Date().toISOString();

    const existing = await db.execute({
      sql: `SELECT id FROM ${tableName} WHERE id = ?`,
      args: [id],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE ${tableName} SET
          title = COALESCE(?, title),
          company = COALESCE(?, company),
          location = COALESCE(?, location),
          work_mode = ?,
          salary_range = COALESCE(?, salary_range),
          job_url = COALESCE(?, job_url),
          apply_url = COALESCE(?, apply_url),
          job_description = COALESCE(?, job_description),
          recruiter_name = COALESCE(?, recruiter_name),
          recruiter_email = COALESCE(?, recruiter_email),
          recruiter_url = COALESCE(?, recruiter_url),
          poster_name = COALESCE(?, poster_name),
          poster_headline = COALESCE(?, poster_headline),
          poster_url = COALESCE(?, poster_url),
          post_content = COALESCE(?, post_content),
          post_url = COALESCE(?, post_url),
          fit_score = MAX(fit_score, ?),
          stack_match = MAX(stack_match, ?),
          seniority_match = ?,
          urgency = ?,
          reasoning = COALESCE(?, reasoning),
          draft_message = COALESCE(?, draft_message),
          keyword_match = COALESCE(?, keyword_match),
          updated_at = ?
        WHERE id = ?`,
        args: [
          job.title || null, job.company || null, job.location || null,
          job.work_mode,
          job.salary_range || null, job.job_url || null, job.apply_url || null,
          job.job_description || null,
          job.recruiter_name || null, job.recruiter_email || null, job.recruiter_url || null,
          job.poster_name || null, job.poster_headline || null, job.poster_url || null,
          job.post_content || null, job.post_url || null,
          job.fit_score, job.stack_match,
          job.seniority_match, job.urgency,
          job.reasoning || null, job.draft_message || null,
          job.keyword_match || null,
          now, id,
        ],
      });
      return { isNew: false };
    }

    await db.execute({
      sql: `INSERT INTO ${tableName} (
        id, dedup_key, source,
        title, company, location, work_mode, salary_range, job_url, apply_url, job_description,
        recruiter_name, recruiter_email, recruiter_url,
        poster_name, poster_headline, poster_url, post_content, post_url,
        fit_score, stack_match, seniority_match, urgency, reasoning, draft_message,
        keyword_match, status, notes, found_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?)`,
      args: [
        id, job.dedup_key, job.source,
        job.title, job.company || "", job.location || "", job.work_mode, job.salary_range || null,
        job.job_url || "", job.apply_url || "", job.job_description || "",
        job.recruiter_name || "", job.recruiter_email || "", job.recruiter_url || "",
        job.poster_name || "", job.poster_headline || "", job.poster_url || "",
        job.post_content || "", job.post_url || "",
        job.fit_score, job.stack_match, job.seniority_match, job.urgency,
        job.reasoning || "", job.draft_message || "",
        job.keyword_match || "",
        job.found_at, now,
      ],
    });

    return { isNew: true };
  }

  async function logJobRunStart(): Promise<number> {
    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `INSERT INTO ${runTableName} (started_at, searches_run, jobs_found, jobs_new) VALUES (?, 0, 0, 0)`,
      args: [now],
    });
    return Number(result.lastInsertRowid);
  }

  async function logJobRunEnd(
    runId: number,
    stats: { searches_run: number; jobs_found: number; jobs_new: number }
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE ${runTableName} SET completed_at = ?, searches_run = ?, jobs_found = ?, jobs_new = ? WHERE id = ?`,
      args: [now, stats.searches_run, stats.jobs_found, stats.jobs_new, runId],
    });
  }

  return { upsertJob, logJobRunStart, logJobRunEnd };
}

export const jobOps = createJobOps("jobs", "job_runs");
export const anushaJobOps = createJobOps("anusha_jobs", "anusha_job_runs");

// ───── Voyager enrichment DB update ─────

export async function updateLeadContactInfo(
  id: string,
  email: string,
  contactInfo: string
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE leads SET
      contact_email = COALESCE(NULLIF(?, ''), contact_email),
      contact_info = COALESCE(NULLIF(?, ''), contact_info),
      updated_at = ?
    WHERE id = ?`,
    args: [email, contactInfo, new Date().toISOString(), id],
  });
}
