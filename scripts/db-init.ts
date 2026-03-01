/**
 * db-init.ts — Ensure all tables exist in Turso (IF NOT EXISTS).
 *
 * Usage: npx tsx scripts/db-init.ts
 */

import { loadEnv } from "../src/lib/pipeline/env";
loadEnv();

import { getDb } from "../src/lib/db";

async function main() {
  const db = getDb();
  console.log("Initializing Turso database tables...\n");

  // ───── Leads tables ─────

  await db.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      headline        TEXT,
      company         TEXT,
      profile_url     TEXT UNIQUE,
      public_profile_url TEXT DEFAULT '',
      post_content    TEXT,
      post_url        TEXT,
      keyword_match   TEXT,
      tier            INTEGER NOT NULL DEFAULT 1,
      relevance       REAL NOT NULL DEFAULT 0.0,
      urgency         TEXT NOT NULL DEFAULT 'low',
      draft_message   TEXT,
      status          TEXT NOT NULL DEFAULT 'new',
      found_at        TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      contact_email   TEXT DEFAULT '',
      contact_info    TEXT DEFAULT '',
      post_date       TEXT DEFAULT ''
    )
  `);
  console.log("  leads table: OK");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at      TEXT NOT NULL,
      completed_at    TEXT,
      searches_run    INTEGER NOT NULL DEFAULT 0,
      leads_found     INTEGER NOT NULL DEFAULT 0,
      leads_new       INTEGER NOT NULL DEFAULT 0
    )
  `);
  console.log("  runs table: OK");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS seen_posts (
      content_hash TEXT PRIMARY KEY,
      profile_url  TEXT NOT NULL,
      found_at     TEXT NOT NULL
    )
  `);
  console.log("  seen_posts table: OK");

  // Leads indices
  const leadIndices = [
    "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)",
    "CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier)",
    "CREATE INDEX IF NOT EXISTS idx_leads_urgency ON leads(urgency)",
    "CREATE INDEX IF NOT EXISTS idx_leads_found_at ON leads(found_at)",
  ];
  for (const sql of leadIndices) await db.execute(sql);
  console.log("  leads indices: OK");

  // ───── Jobs tables (Ashmit) ─────

  await db.execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      id              TEXT PRIMARY KEY,
      dedup_key       TEXT UNIQUE NOT NULL,
      source          TEXT NOT NULL DEFAULT 'content',
      title           TEXT NOT NULL DEFAULT '',
      company         TEXT DEFAULT '',
      location        TEXT DEFAULT '',
      work_mode       TEXT NOT NULL DEFAULT 'unknown',
      salary_range    TEXT,
      job_url         TEXT DEFAULT '',
      apply_url       TEXT DEFAULT '',
      job_description TEXT DEFAULT '',
      recruiter_name  TEXT DEFAULT '',
      recruiter_email TEXT DEFAULT '',
      recruiter_url   TEXT DEFAULT '',
      poster_name     TEXT DEFAULT '',
      poster_headline TEXT DEFAULT '',
      poster_url      TEXT DEFAULT '',
      post_content    TEXT DEFAULT '',
      post_url        TEXT DEFAULT '',
      fit_score       REAL NOT NULL DEFAULT 0.0,
      stack_match     REAL NOT NULL DEFAULT 0.0,
      seniority_match TEXT NOT NULL DEFAULT 'unknown',
      urgency         TEXT NOT NULL DEFAULT 'low',
      reasoning       TEXT DEFAULT '',
      draft_message   TEXT DEFAULT '',
      keyword_match   TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'new',
      notes           TEXT DEFAULT '',
      found_at        TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )
  `);
  console.log("  jobs table: OK");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS job_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at      TEXT NOT NULL,
      completed_at    TEXT,
      searches_run    INTEGER NOT NULL DEFAULT 0,
      jobs_found      INTEGER NOT NULL DEFAULT 0,
      jobs_new        INTEGER NOT NULL DEFAULT 0
    )
  `);
  console.log("  job_runs table: OK");

  const jobIndices = [
    "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_fit_score ON jobs(fit_score)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_found_at ON jobs(found_at)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_work_mode ON jobs(work_mode)",
  ];
  for (const sql of jobIndices) await db.execute(sql);
  console.log("  jobs indices: OK");

  // ───── Anusha Jobs tables ─────

  await db.execute(`
    CREATE TABLE IF NOT EXISTS anusha_jobs (
      id              TEXT PRIMARY KEY,
      dedup_key       TEXT UNIQUE NOT NULL,
      source          TEXT NOT NULL DEFAULT 'content',
      title           TEXT NOT NULL DEFAULT '',
      company         TEXT DEFAULT '',
      location        TEXT DEFAULT '',
      work_mode       TEXT NOT NULL DEFAULT 'unknown',
      salary_range    TEXT,
      job_url         TEXT DEFAULT '',
      apply_url       TEXT DEFAULT '',
      job_description TEXT DEFAULT '',
      recruiter_name  TEXT DEFAULT '',
      recruiter_email TEXT DEFAULT '',
      recruiter_url   TEXT DEFAULT '',
      poster_name     TEXT DEFAULT '',
      poster_headline TEXT DEFAULT '',
      poster_url      TEXT DEFAULT '',
      post_content    TEXT DEFAULT '',
      post_url        TEXT DEFAULT '',
      fit_score       REAL NOT NULL DEFAULT 0.0,
      stack_match     REAL NOT NULL DEFAULT 0.0,
      seniority_match TEXT NOT NULL DEFAULT 'unknown',
      urgency         TEXT NOT NULL DEFAULT 'low',
      reasoning       TEXT DEFAULT '',
      draft_message   TEXT DEFAULT '',
      keyword_match   TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'new',
      notes           TEXT DEFAULT '',
      found_at        TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )
  `);
  console.log("  anusha_jobs table: OK");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS anusha_job_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at      TEXT NOT NULL,
      completed_at    TEXT,
      searches_run    INTEGER NOT NULL DEFAULT 0,
      jobs_found      INTEGER NOT NULL DEFAULT 0,
      jobs_new        INTEGER NOT NULL DEFAULT 0
    )
  `);
  console.log("  anusha_job_runs table: OK");

  const anushaIndices = [
    "CREATE INDEX IF NOT EXISTS idx_anusha_jobs_status ON anusha_jobs(status)",
    "CREATE INDEX IF NOT EXISTS idx_anusha_jobs_fit_score ON anusha_jobs(fit_score)",
    "CREATE INDEX IF NOT EXISTS idx_anusha_jobs_source ON anusha_jobs(source)",
    "CREATE INDEX IF NOT EXISTS idx_anusha_jobs_found_at ON anusha_jobs(found_at)",
    "CREATE INDEX IF NOT EXISTS idx_anusha_jobs_work_mode ON anusha_jobs(work_mode)",
  ];
  for (const sql of anushaIndices) await db.execute(sql);
  console.log("  anusha_jobs indices: OK");

  // ───── Migrations (safe ALTERs for existing DBs) ─────

  console.log("\nRunning migrations...");
  const migrations = [
    "ALTER TABLE leads ADD COLUMN contact_email TEXT DEFAULT ''",
    "ALTER TABLE leads ADD COLUMN contact_info TEXT DEFAULT ''",
    "ALTER TABLE leads ADD COLUMN post_date TEXT DEFAULT ''",
    "ALTER TABLE leads ADD COLUMN public_profile_url TEXT DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN apply_url TEXT DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN recruiter_name TEXT DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN recruiter_email TEXT DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN recruiter_url TEXT DEFAULT ''",
    "ALTER TABLE anusha_jobs ADD COLUMN apply_url TEXT DEFAULT ''",
    "ALTER TABLE anusha_jobs ADD COLUMN recruiter_name TEXT DEFAULT ''",
    "ALTER TABLE anusha_jobs ADD COLUMN recruiter_email TEXT DEFAULT ''",
    "ALTER TABLE anusha_jobs ADD COLUMN recruiter_url TEXT DEFAULT ''",
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql);
      console.log(`  Applied: ${sql.slice(0, 60)}...`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  console.log("\nDatabase initialization complete.");
}

main().catch((err) => {
  console.error("DB init failed:", err);
  process.exit(1);
});
