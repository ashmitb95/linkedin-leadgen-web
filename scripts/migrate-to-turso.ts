/**
 * migrate-to-turso.ts — One-time migration from local SQLite to Turso.
 *
 * Reads leads.db, jobs.db, and anusha-jobs.db from the sibling linkedin-leadgen
 * project and inserts all data into the Turso cloud database.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-turso.ts
 *
 * Env vars required: TURSO_DATABASE_URL, TURSO_DATABASE_TOKEN
 * (reads from .env.local automatically)
 */

import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx);
    let val = trimmed.slice(eqIdx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const SIBLING_DIR = path.join(__dirname, "..", "..", "linkedin-leadgen");
const LEADS_DB = path.join(SIBLING_DIR, "db", "leads.db");
const JOBS_DB = path.join(SIBLING_DIR, "db", "jobs.db");
const ANUSHA_DB = path.join(SIBLING_DIR, "db", "anusha-jobs.db");

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_DATABASE_TOKEN!,
});

async function createTables() {
  console.log("Creating tables in Turso...");

  const statements = [
    // Leads tables
    `CREATE TABLE IF NOT EXISTS leads (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      headline      TEXT,
      company       TEXT,
      profile_url   TEXT UNIQUE,
      post_content  TEXT,
      post_url      TEXT,
      keyword_match TEXT,
      tier          INTEGER NOT NULL DEFAULT 1,
      relevance     REAL NOT NULL DEFAULT 0.0,
      urgency       TEXT NOT NULL DEFAULT 'low',
      draft_message TEXT,
      status        TEXT NOT NULL DEFAULT 'new',
      found_at      TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      contact_email TEXT DEFAULT '',
      contact_info  TEXT DEFAULT '',
      post_date     TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at    TEXT NOT NULL,
      completed_at  TEXT,
      searches_run  INTEGER NOT NULL DEFAULT 0,
      leads_found   INTEGER NOT NULL DEFAULT 0,
      leads_new     INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS seen_posts (
      content_hash TEXT PRIMARY KEY,
      profile_url  TEXT NOT NULL,
      found_at     TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_urgency ON leads(urgency)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_found_at ON leads(found_at)`,

    // Jobs tables
    `CREATE TABLE IF NOT EXISTS jobs (
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
    )`,
    `CREATE TABLE IF NOT EXISTS job_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at      TEXT NOT NULL,
      completed_at    TEXT,
      searches_run    INTEGER NOT NULL DEFAULT 0,
      jobs_found      INTEGER NOT NULL DEFAULT 0,
      jobs_new        INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_fit_score ON jobs(fit_score)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_found_at ON jobs(found_at)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_work_mode ON jobs(work_mode)`,

    // Anusha jobs tables (same schema, different table names)
    `CREATE TABLE IF NOT EXISTS anusha_jobs (
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
    )`,
    `CREATE TABLE IF NOT EXISTS anusha_job_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at      TEXT NOT NULL,
      completed_at    TEXT,
      searches_run    INTEGER NOT NULL DEFAULT 0,
      jobs_found      INTEGER NOT NULL DEFAULT 0,
      jobs_new        INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_anusha_jobs_status ON anusha_jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_anusha_jobs_fit_score ON anusha_jobs(fit_score)`,
    `CREATE INDEX IF NOT EXISTS idx_anusha_jobs_source ON anusha_jobs(source)`,
    `CREATE INDEX IF NOT EXISTS idx_anusha_jobs_found_at ON anusha_jobs(found_at)`,
    `CREATE INDEX IF NOT EXISTS idx_anusha_jobs_work_mode ON anusha_jobs(work_mode)`,
  ];

  for (const sql of statements) {
    await turso.execute(sql);
  }

  console.log("All tables and indices created.");
}

async function migrateTable(
  localDb: Database.Database,
  sourceTable: string,
  targetTable: string,
  columns: string[]
) {
  const rows = localDb.prepare(`SELECT * FROM ${sourceTable}`).all() as Record<string, unknown>[];
  if (rows.length === 0) {
    console.log(`  ${sourceTable} → ${targetTable}: 0 rows (empty)`);
    return;
  }

  const placeholders = columns.map(() => "?").join(", ");
  const colList = columns.join(", ");
  const batchSize = 50;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await turso.batch(
      batch.map((row) => ({
        sql: `INSERT OR IGNORE INTO ${targetTable} (${colList}) VALUES (${placeholders})`,
        args: columns.map((col) => (row[col] as string | number | null) ?? null),
      }))
    );
  }

  // Verify
  const countRes = await turso.execute(`SELECT COUNT(*) as c FROM ${targetTable}`);
  console.log(`  ${sourceTable} → ${targetTable}: ${rows.length} local → ${countRes.rows[0].c} in Turso`);
}

async function main() {
  console.log("\n=== LinkedIn LeadGen → Turso Migration ===\n");

  await createTables();

  // Migrate leads.db
  if (fs.existsSync(LEADS_DB)) {
    console.log(`\nMigrating leads.db...`);
    const db = new Database(LEADS_DB, { readonly: true });

    await migrateTable(db, "leads", "leads", [
      "id", "name", "headline", "company", "profile_url",
      "post_content", "post_url", "keyword_match", "tier",
      "relevance", "urgency", "draft_message", "status",
      "found_at", "updated_at", "contact_email", "contact_info", "post_date",
    ]);

    await migrateTable(db, "runs", "runs", [
      "id", "started_at", "completed_at", "searches_run", "leads_found", "leads_new",
    ]);

    // Check if seen_posts table exists
    const hasSeen = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='seen_posts'"
    ).get();
    if (hasSeen) {
      await migrateTable(db, "seen_posts", "seen_posts", [
        "content_hash", "profile_url", "found_at",
      ]);
    }

    db.close();
  } else {
    console.log(`\nSkipping leads.db (not found at ${LEADS_DB})`);
  }

  // Migrate jobs.db
  if (fs.existsSync(JOBS_DB)) {
    console.log(`\nMigrating jobs.db...`);
    const db = new Database(JOBS_DB, { readonly: true });

    const jobCols = [
      "id", "dedup_key", "source", "title", "company", "location",
      "work_mode", "salary_range", "job_url", "apply_url", "job_description",
      "recruiter_name", "recruiter_email", "recruiter_url",
      "poster_name", "poster_headline", "poster_url",
      "post_content", "post_url", "fit_score", "stack_match",
      "seniority_match", "urgency", "reasoning", "draft_message",
      "keyword_match", "status", "notes", "found_at", "updated_at",
    ];

    // Filter to only columns that exist in the local DB
    const localCols = new Set(
      (db.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]).map((c) => c.name)
    );
    const filteredJobCols = jobCols.filter((c) => localCols.has(c));

    await migrateTable(db, "jobs", "jobs", filteredJobCols);
    await migrateTable(db, "job_runs", "job_runs", [
      "id", "started_at", "completed_at", "searches_run", "jobs_found", "jobs_new",
    ]);

    db.close();
  } else {
    console.log(`\nSkipping jobs.db (not found at ${JOBS_DB})`);
  }

  // Migrate anusha-jobs.db
  if (fs.existsSync(ANUSHA_DB)) {
    console.log(`\nMigrating anusha-jobs.db...`);
    const db = new Database(ANUSHA_DB, { readonly: true });

    const jobCols = [
      "id", "dedup_key", "source", "title", "company", "location",
      "work_mode", "salary_range", "job_url", "apply_url", "job_description",
      "recruiter_name", "recruiter_email", "recruiter_url",
      "poster_name", "poster_headline", "poster_url",
      "post_content", "post_url", "fit_score", "stack_match",
      "seniority_match", "urgency", "reasoning", "draft_message",
      "keyword_match", "status", "notes", "found_at", "updated_at",
    ];

    const localCols = new Set(
      (db.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]).map((c) => c.name)
    );
    const filteredJobCols = jobCols.filter((c) => localCols.has(c));

    // Source table is "jobs" in anusha-jobs.db, target is "anusha_jobs" in Turso
    await migrateTable(db, "jobs", "anusha_jobs", filteredJobCols);
    await migrateTable(db, "job_runs", "anusha_job_runs", [
      "id", "started_at", "completed_at", "searches_run", "jobs_found", "jobs_new",
    ]);

    db.close();
  } else {
    console.log(`\nSkipping anusha-jobs.db (not found at ${ANUSHA_DB})`);
  }

  console.log("\n=== Migration complete! ===\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
