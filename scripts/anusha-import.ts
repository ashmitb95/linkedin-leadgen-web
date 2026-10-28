/**
 * anusha-import.ts — Load the crawled company intel into Turso for the outreach page.
 *
 * Reads data/anusha-company-intel.json (from anusha-company-crawl.ts), asks Claude
 * to label each not-yet-ranked contact against Anusha's profile, then upserts
 * anusha_companies + anusha_contacts. Never touches anusha_outreach.
 *
 * Usage:
 *   npx tsx scripts/anusha-import.ts            # Import, ranking only new contacts
 *   npx tsx scripts/anusha-import.ts --rerank   # Re-rank every contact
 *   npx tsx scripts/anusha-import.ts --no-rank  # Import without calling Claude
 */

import { loadEnv } from "../src/lib/pipeline/env";
loadEnv();

import { readFileSync } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

import { getDb } from "../src/lib/db";
import { CONTACT_LABELS, type ContactLabel } from "../src/lib/anusha-companies-shared";

const INTEL_PATH = path.resolve(process.cwd(), "data", "anusha-company-intel.json");
const PROFILE_PATH = path.resolve(process.cwd(), "config", "anusha-job-profile.json");
const RESUME_PATH = path.resolve(process.cwd(), "config", "anusha-resume.md");
const CONFIG_PATH = path.resolve(process.cwd(), "config", "anusha-companies.json");

const RERANK = process.argv.includes("--rerank");
const NO_RANK = process.argv.includes("--no-rank");

interface CrawledPerson {
  name: string;
  degree: string;
  headline: string;
  location: string;
  current: string;
  profileUrl: string;
  role: string;
}

interface Ranked {
  label: ContactLabel;
  score: number;
  reason: string;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// LinkedIn /in/<slug>/ is stable per person, so it doubles as the contact id.
const contactId = (profileUrl: string) => (profileUrl.match(/\/in\/([^/?#]+)/) || [])[1]?.toLowerCase() || "";

let candidate = "";
try {
  candidate = readFileSync(RESUME_PATH, "utf-8");
} catch {
  candidate = readFileSync(PROFILE_PATH, "utf-8");
}

const RANK_SCHEMA = {
  type: "object",
  properties: {
    contacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          label: { type: "string", enum: [...CONTACT_LABELS] },
          score: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["index", "label", "score", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["contacts"],
  additionalProperties: false,
};

async function rankCompany(client: Anthropic, company: string, teams: string, people: (CrawledPerson & { isAlumni: boolean })[]): Promise<Map<number, Ranked>> {
  const list = people
    .map((p, i) =>
      `${i}. ${p.name} | ${p.current || p.headline} | headline: ${p.headline} | ${p.location}` +
      (p.isAlumni ? " | ex-Bharat Biotech (her former employer)" : ""),
    )
    .join("\n");

  const prompt = `You are helping a job seeker decide whom to cold-email at ${company}.

<candidate>
${candidate}
</candidate>

She is targeting analyst/associate roles in strategy, market or competitive intelligence, business development or commercial analytics. Teams at ${company} worth reaching: ${teams}.

Label each person below:
- hiring_manager: likely to manage or sit one level above the roles she wants (strategy, intelligence, insights, BD, commercial, portfolio leads/managers/heads).
- referrer: not a hiring manager, but well placed to refer her internally — peers in those functions, or anyone ex-Bharat Biotech regardless of function.
- recruiter: talent acquisition / recruiting / HR business partners who hire for business roles.
- not_relevant: unrelated functions (software, data engineering, lab science with no tie to her, admin) and not ex-Bharat Biotech.

score: 0-100, how useful this person is to contact first. reason: one short plain-English sentence she can read, e.g. "Leads forecasting & analytics — the team her market-modelling skills fit."

<people>
${list}
</people>

Return one entry per person, using their index.`;

  const response = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 16000,
    output_config: { format: { type: "json_schema", schema: RANK_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((b) => b.type === "text");
  if (response.stop_reason !== "end_turn" || !text || text.type !== "text") {
    throw new Error(`ranking stopped early (${response.stop_reason})`);
  }
  const parsed = JSON.parse(text.text) as { contacts: (Ranked & { index: number })[] };
  return new Map(parsed.contacts.map((c) => [c.index, { label: c.label, score: Math.max(0, Math.min(100, c.score)), reason: c.reason }]));
}

async function main() {
  const intel = JSON.parse(readFileSync(INTEL_PATH, "utf-8")).companies as Record<string, any>;
  const order: string[] = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")).companies.map((c: { name: string }) => c.name);
  const db = getDb();
  const client = NO_RANK ? null : new Anthropic();

  const ranked = new Map<string, Ranked>();
  if (!RERANK) {
    const existing = await db.execute("SELECT id, ai_label, ai_score, ai_reason FROM anusha_contacts WHERE ai_label != ''");
    for (const r of existing.rows) {
      ranked.set(String(r.id), { label: r.ai_label as ContactLabel, score: Number(r.ai_score), reason: String(r.ai_reason) });
    }
  }

  const names = Object.keys(intel).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const [i, name] of names.entries()) {
    const c = intel[name];
    if (!c.linkedinUrl) {
      console.log(`[${i + 1}/${names.length}] ${name}: skipped (no LinkedIn data)`);
      continue;
    }
    const slug = slugify(name);

    await db.execute({
      sql: `INSERT INTO anusha_companies (slug, sort_order, name, tier, cities, type, hook, teams, linkedin_url, linkedin_id,
              website, careers_url, industry, size, headquarters, jobs_search_url, jobs, crawled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              sort_order = excluded.sort_order, name = excluded.name, tier = excluded.tier, cities = excluded.cities,
              type = excluded.type, hook = excluded.hook, teams = excluded.teams, linkedin_url = excluded.linkedin_url,
              linkedin_id = excluded.linkedin_id, website = excluded.website, careers_url = excluded.careers_url,
              industry = excluded.industry, size = excluded.size, headquarters = excluded.headquarters,
              jobs_search_url = excluded.jobs_search_url, jobs = excluded.jobs, crawled_at = excluded.crawled_at`,
      args: [
        slug, order.indexOf(name), name, c.tier, JSON.stringify(c.cities), c.type || "", c.hook || "", c.teams || "",
        c.linkedinUrl || "", c.linkedinId || "", c.website || "", c.careersUrl || "", c.industry || "", c.size || "",
        c.headquarters || "", c.jobsSearchUrl || "", JSON.stringify(c.jobs || []), c.crawledAt || "",
      ],
    });

    // A person can appear under several searches and in the alumni list — merge by id.
    const people = new Map<string, CrawledPerson & { isAlumni: boolean }>();
    for (const p of [...(c.people || []), ...(c.alumni || [])] as CrawledPerson[]) {
      const id = contactId(p.profileUrl);
      if (!id) continue;
      const isAlumni = p.role === "Ex-Bharat Biotech";
      const prev = people.get(id);
      people.set(id, { ...(prev || p), isAlumni: isAlumni || !!prev?.isAlumni });
    }

    const toRank = [...people.entries()].filter(([id]) => !ranked.has(id));
    if (client && toRank.length) {
      try {
        const result = await rankCompany(client, name, c.teams || "", toRank.map(([, p]) => p));
        toRank.forEach(([id], idx) => {
          const r = result.get(idx);
          if (r) ranked.set(id, r);
        });
      } catch (e) {
        console.error(`  ranking failed for ${name}: ${(e as Error).message} — imported unranked`);
      }
    }

    // Until Claude ranks them, order contacts round-robin across search groups
    // (LinkedIn's own order within each), so the top 3 span strategy, BD and recruiting.
    const posInGroup = new Map<string, number>();
    const groupSeen = new Map<string, number>();
    for (const [id, p] of people) {
      const n = groupSeen.get(p.role) ?? 0;
      posInGroup.set(id, n);
      groupSeen.set(p.role, n + 1);
    }

    const stmts = [...people.entries()].map(([id, p]) => {
      const r = ranked.get(id);
      return {
        sql: `INSERT INTO anusha_contacts (id, company_slug, name, headline, current_role, location, degree, search_group,
                is_alumni, profile_url, ai_label, ai_score, ai_reason)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                company_slug = excluded.company_slug, name = excluded.name, headline = excluded.headline,
                current_role = excluded.current_role, location = excluded.location, degree = excluded.degree,
                search_group = excluded.search_group, is_alumni = excluded.is_alumni, profile_url = excluded.profile_url,
                ai_label = excluded.ai_label, ai_score = excluded.ai_score, ai_reason = excluded.ai_reason`,
        args: [
          id, slug, p.name, p.headline || "", p.current || "", p.location || "", p.degree || "", p.role || "",
          p.isAlumni ? 1 : 0, p.profileUrl, r?.label || "", r?.score ?? Math.max(0, 50 - posInGroup.get(id)!), r?.reason || "",
        ],
      };
    });
    if (stmts.length) await db.batch(stmts, "write");

    const relevant = [...people.keys()].filter((id) => ranked.get(id)?.label && ranked.get(id)!.label !== "not_relevant").length;
    console.log(`[${i + 1}/${names.length}] ${name}: ${people.size} contacts (${relevant} relevant, ${toRank.length} newly ranked)`);
  }

  console.log("\nImport complete.");
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
