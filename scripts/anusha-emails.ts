/**
 * anusha-emails.ts — Find and verify work emails for each company's top contacts.
 *
 * For the top N relevant contacts per company (by AI score):
 *   1. Company email domain + pattern: config/anusha-email-patterns.json, else
 *      Hunter domain search (cached in data/anusha-email-patterns.cache.json)
 *   2. Build the address from the contact's name
 *   3. MX check (free), then Hunter email verifier within the remaining free credits.
 *      Patterns are tried in order until one verifies. A domain that accepts every
 *      address ("accept_all") is detected once and not re-verified.
 *
 * Writes anusha_contacts.email / email_status / email_note:
 *   verified  — mailbox confirmed by the server
 *   likely    — server accepts all addresses, so it can't be confirmed; pattern-based
 *   guess     — pattern-based, not verified (no credits, server didn't answer, or name shortened)
 *   not_found — every pattern was rejected; use LinkedIn instead
 *
 * Usage:
 *   npx tsx scripts/anusha-emails.ts                 # Top 3 per company, skip ones already done
 *   npx tsx scripts/anusha-emails.ts --top 5         # Top 5 per company
 *   npx tsx scripts/anusha-emails.ts --only sanofi   # One company (slug substring)
 *   npx tsx scripts/anusha-emails.ts --refresh       # Redo contacts that already have a result
 *   npx tsx scripts/anusha-emails.ts --no-verify     # Patterns only, spend no Hunter credits
 *   npx tsx scripts/anusha-emails.ts --skrapp        # Skrapp lookup for contacts Hunter couldn't settle
 */

import { loadEnv } from "../src/lib/pipeline/env";
loadEnv();

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { promises as dns } from "dns";
import path from "path";

import { getDb } from "../src/lib/db";

const PATTERNS_PATH = path.resolve(process.cwd(), "config", "anusha-email-patterns.json");
const CACHE_PATH = path.resolve(process.cwd(), "data", "anusha-email-patterns.cache.json");
const HUNTER = "https://api.hunter.io/v2";
const KEY = process.env.HUNTER_API_KEY || "";

const args = process.argv.slice(2);
const argVal = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const TOP = Number(argVal("--top")) || 3;
const ONLY = argVal("--only")?.toLowerCase();
const REFRESH = args.includes("--refresh");
const NO_VERIFY = args.includes("--no-verify") || !KEY;
const SKRAPP = args.includes("--skrapp");
const SKRAPP_KEY = process.env.SKRAPP_API_KEY || "";

interface DomainInfo {
  domain: string;
  patterns: string[];
  source: string;
}

type Status = "verified" | "likely" | "guess" | "not_found";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hunter(endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, api_key: KEY }).toString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${HUNTER}/${endpoint}?${qs}`);
    // 202 = verification still running server-side; 222 = the target mail server didn't
    // answer this time (retry once, then report "unknown"). Poll again either way.
    if (res.status === 222) {
      if (attempt === 0) {
        await sleep(5000);
        continue;
      }
      return { status: "unknown" };
    }
    if (res.status === 202 || res.status === 429) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(`Hunter ${endpoint} ${res.status}: ${JSON.stringify(body.errors || body)}`);
    return body.data;
  }
  // A verification that never settles is an unclear answer, not a failure.
  if (endpoint === "email-verifier") return { status: "unknown" };
  throw new Error(`Hunter ${endpoint}: still pending after retries`);
}

// ───── Names ─────

const CREDENTIALS = /\b(ph\.?d|pmp|mba|md|mrsc|cfa|frm|ca|cpa|mpharm|msc|m\.sc|b\.tech)\b\.?/gi;

function splitName(raw: string): { first: string; last: string; lastIsInitial: boolean } | null {
  let s = raw.replace(/[®©™]/g, "").replace(/\(.*?\)/g, "");
  // "Tandon, Ajay" → "Ajay Tandon"; "Name, Ph.D., MRSC" → "Name"
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const rest = parts.slice(1).filter((p) => p.replace(CREDENTIALS, "").trim().length > 1);
  s = rest.length === 1 && parts.length === 2 && !/\s/.test(parts[0]) ? `${rest[0]} ${parts[0]}` : parts[0] || "";
  s = s.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "").replace(CREDENTIALS, "");
  const tokens = s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  if (!tokens.length) return null;
  const first = tokens[0];
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : "";
  return { first, last, lastIsInitial: last.length <= 1 };
}

function build(pattern: string, n: { first: string; last: string }): string | null {
  if (/\{(last|l)\}/.test(pattern) && !n.last) return null;
  return pattern
    .replace(/\{first\}/g, n.first)
    .replace(/\{last\}/g, n.last)
    .replace(/\{f\}/g, n.first[0])
    .replace(/\{l\}/g, n.last[0] || "");
}

/**
 * A verified address proves which pattern a company uses. Unverified guesses at the
 * same company built from that pattern are upgraded to "likely". Returns the count.
 */
async function upgradeFromVerifiedColleague(slug: string, info: DomainInfo): Promise<number> {
  const db = getDb();
  const rows = (await db.execute({
    sql: "SELECT id, name, email, email_status, email_note FROM anusha_contacts WHERE company_slug = ? AND email_status IN ('verified', 'guess')",
    args: [slug],
  })).rows;
  const addressFor = (name: string, pattern: string) => {
    const n = splitName(name);
    const local = n && build(pattern, n);
    return local ? `${local}@${info.domain}` : "";
  };

  const proven = info.patterns.find((p) =>
    rows.some((r) => r.email_status === "verified" && addressFor(String(r.name), p) === r.email),
  );
  if (!proven) return 0;

  let count = 0;
  for (const r of rows) {
    if (r.email_status !== "guess" || addressFor(String(r.name), proven) !== r.email) continue;
    const shortened = String(r.email_note).includes("shortened");
    await db.execute({
      sql: "UPDATE anusha_contacts SET email_status = 'likely', email_note = ? WHERE id = ?",
      args: [
        "Same format as a colleague's address the mail server confirmed" +
          (shortened ? " · last name is shortened on LinkedIn, so the pattern may not fit" : ""),
        String(r.id),
      ],
    });
    count++;
  }
  return count;
}

// ───── Skrapp fallback ─────

const SKRAPP_STATUS: Record<string, { status: Status; note: string }> = {
  valid: { status: "verified", note: "Found and confirmed by Skrapp" },
  "catch-all": { status: "likely", note: "Found by Skrapp; company mail server accepts any address, so it can't be confirmed" },
  unknown: { status: "guess", note: "Found by Skrapp, but the mail server didn't give a clear answer" },
};

/**
 * Second pass for the contacts Hunter couldn't settle (not_found, never tried, or guess):
 * Skrapp looks people up by name + domain in its own data. It charges a credit only
 * when it finds an address, so not-found lookups are free.
 */
async function skrappPass() {
  if (!SKRAPP_KEY) throw new Error("SKRAPP_API_KEY is not set");
  const headers = { "X-Access-Key": SKRAPP_KEY };
  const account = await (await fetch("https://api.skrapp.io/api/v2/account", { headers })).json();
  let creditsLeft = account.credit.email.quota - account.credit.email.used;
  console.log(`Skrapp credits: ${creditsLeft} left`);

  const configured: Record<string, DomainInfo> = JSON.parse(readFileSync(PATTERNS_PATH, "utf-8")).companies;
  const cache: Record<string, DomainInfo> = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : {};
  const db = getDb();
  const companies = (await db.execute("SELECT slug, name, website FROM anusha_companies ORDER BY sort_order")).rows
    .filter((c) => !ONLY || String(c.slug).includes(ONLY));
  const tally: Record<string, number> = {};

  for (const c of companies) {
    if (creditsLeft <= 0) break;
    const slug = String(c.slug);
    const website = String(c.website);
    const domain = (configured[slug] || cache[slug])?.domain ||
      (website ? new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "") : "");
    if (!domain) continue;

    const rows = (await db.execute({
      sql: `SELECT id, name, email_status FROM anusha_contacts
            WHERE company_slug = ? AND ai_label != 'not_relevant'
            ORDER BY ai_score DESC, name LIMIT ?`,
      args: [slug, TOP],
    })).rows.filter((r) => ["", "not_found", "guess"].includes(String(r.email_status)));

    const results: string[] = [];
    for (const r of rows) {
      if (creditsLeft <= 0) break;
      const n = splitName(String(r.name));
      if (!n) continue;
      const params = new URLSearchParams(
        n.last && !n.lastIsInitial
          ? { firstName: n.first, lastName: n.last, domain }
          : { fullName: String(r.name), domain },
      );
      const res = await fetch(`https://api.skrapp.io/api/v2/find?${params}`, { headers });
      if (res.status === 404) {
        if (!r.email_status) {
          await db.execute({
            sql: "UPDATE anusha_contacts SET email_status = 'not_found', email_note = ? WHERE id = ?",
            args: ["No address found by Hunter or Skrapp", String(r.id)],
          });
        }
        tally.not_found = (tally.not_found || 0) + 1;
        results.push("not found");
        continue;
      }
      if (!res.ok) {
        console.error(`  ${r.name}: Skrapp ${res.status} ${await res.text()}`);
        continue;
      }
      const data = await res.json();
      creditsLeft--;
      const mapped = SKRAPP_STATUS[data.quality?.status];
      if (!data.email || !mapped) {
        results.push(`rejected ${data.email || ""}`.trim());
        continue;
      }
      // Don't downgrade an existing guess to another guess.
      if (r.email_status === "guess" && mapped.status === "guess") {
        results.push(`still guess ${data.email}`);
        continue;
      }
      await db.execute({
        sql: "UPDATE anusha_contacts SET email = ?, email_status = ?, email_note = ? WHERE id = ?",
        args: [data.email, mapped.status, mapped.note, String(r.id)],
      });
      tally[mapped.status] = (tally[mapped.status] || 0) + 1;
      results.push(`${mapped.status} ${data.email}`);
    }
    if (results.length) console.log(`${c.name}: ${results.join(", ")}`);
  }

  console.log(`\nSkrapp done: ${JSON.stringify(tally)} · ${creditsLeft} credits left`);
}

// ───── Main ─────

async function main() {
  if (SKRAPP) return skrappPass();

  const configured: Record<string, DomainInfo> = JSON.parse(readFileSync(PATTERNS_PATH, "utf-8")).companies;
  const cache: Record<string, DomainInfo> = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : {};
  const saveCache = () => {
    mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  };

  let searchesLeft = 0;
  let verificationsLeft = 0;
  if (KEY) {
    const account = await hunter("account", {});
    searchesLeft = account.requests.searches.available - account.requests.searches.used;
    verificationsLeft = account.requests.verifications.available - account.requests.verifications.used;
    console.log(`Hunter credits: ${searchesLeft} searches, ${verificationsLeft} verifications left this month`);
  } else {
    console.log("No HUNTER_API_KEY — using researched patterns only, no verification.");
  }
  if (NO_VERIFY) verificationsLeft = 0;

  const db = getDb();
  const companies = (await db.execute("SELECT slug, name, website FROM anusha_companies ORDER BY sort_order")).rows
    .map((r) => ({ slug: String(r.slug), name: String(r.name), website: String(r.website) }))
    .filter((c) => !ONLY || c.slug.includes(ONLY));

  const tally: Record<string, number> = {};

  for (const c of companies) {
    let info = configured[c.slug] || cache[c.slug];
    if (!info && KEY && searchesLeft > 0) {
      const domain = new URL(c.website.startsWith("http") ? c.website : `https://${c.website}`).hostname.replace(/^www\./, "");
      try {
        const data = await hunter("domain-search", { domain, limit: "10" });
        searchesLeft--;
        if (data.pattern) {
          info = { domain, patterns: [data.pattern], source: "Hunter domain search" };
          cache[c.slug] = info;
          saveCache();
        }
      } catch (e) {
        console.error(`  ${c.name}: domain search failed — ${(e as Error).message}`);
      }
    }
    if (!info) {
      console.log(`${c.name}: no email pattern known — skipped`);
      continue;
    }

    try {
      const mx = await dns.resolveMx(info.domain);
      if (!mx.length) throw new Error("no MX records");
    } catch (e) {
      console.log(`${c.name}: ${info.domain} doesn't receive email (${(e as Error).message}) — skipped`);
      continue;
    }

    const contacts = (await db.execute({
      sql: `SELECT id, name, email_status FROM anusha_contacts
            WHERE company_slug = ? AND ai_label != 'not_relevant'
            ORDER BY ai_score DESC, name LIMIT ?`,
      args: [c.slug, TOP],
    })).rows;

    let acceptAll = false;
    const results: string[] = [];

    for (const row of contacts) {
      if (!REFRESH && row.email_status) continue;
      const name = splitName(String(row.name));
      let email = "";
      let status: Status = "guess";
      let note = "";

      const candidates = name ? info.patterns.map((p) => build(p, name)).filter((e): e is string => !!e).map((l) => `${l}@${info!.domain}`) : [];
      if (!candidates.length) {
        status = "not_found";
        note = "Name too short on LinkedIn to build an address";
      } else if (acceptAll || verificationsLeft <= 0) {
        email = candidates[0];
        status = acceptAll ? "likely" : "guess";
        note = acceptAll ? "Company mail server accepts any address, so this can't be confirmed" : "Based on the company's email pattern, not verified";
      } else {
        status = "not_found";
        note = "Every likely address was rejected by the mail server";
        for (const candidate of candidates) {
          if (verificationsLeft <= 0) {
            email = candidate;
            status = "guess";
            note = "Based on the company's email pattern, not verified";
            break;
          }
          const v = await hunter("email-verifier", { email: candidate });
          verificationsLeft--;
          if (v.status === "valid") {
            email = candidate;
            status = "verified";
            note = "Mailbox confirmed by the company's mail server";
            break;
          }
          if (v.status === "accept_all") {
            acceptAll = true;
            email = candidate;
            status = "likely";
            note = "Company mail server accepts any address, so this can't be confirmed";
            break;
          }
          if (v.status !== "invalid") {
            email = candidate;
            status = "guess";
            note = "Mail server didn't give a clear answer";
            break;
          }
        }
      }
      if (email && name?.lastIsInitial) note += " · last name is shortened on LinkedIn, so the pattern may not fit";

      await db.execute({
        sql: "UPDATE anusha_contacts SET email = ?, email_status = ?, email_note = ? WHERE id = ?",
        args: [email, status, note, String(row.id)],
      });
      tally[status] = (tally[status] || 0) + 1;
      results.push(`${status}${email ? ` ${email}` : ""}`);
    }

    const upgraded = await upgradeFromVerifiedColleague(c.slug, info);

    console.log(
      `${c.name} (${info.patterns.join(" / ")}@${info.domain}): ${results.join(", ") || "already done"}` +
      (upgraded ? ` · ${upgraded} upgraded to likely` : ""),
    );
  }

  console.log(`\nDone: ${JSON.stringify(tally)} · Hunter left: ${searchesLeft} searches, ${verificationsLeft} verifications`);
}

main().catch((err) => {
  console.error("Email run failed:", err);
  process.exit(1);
});
