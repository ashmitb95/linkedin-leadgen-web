/**
 * anusha-company-crawl.ts — Enrich Anusha's target-company list from LinkedIn.
 *
 * For each company in config/anusha-companies.json:
 *   1. Resolve the LinkedIn company page (search → first company result)
 *   2. About page → website, industry, size, HQ, numeric company id
 *   3. Website homepage → careers page link (plain fetch, no LinkedIn)
 *   4. LinkedIn Jobs (company filter, India) → openings, flagged by title relevance
 *   5. People search (company + target cities) → contacts by function
 *   6. People search (company + past Bharat Biotech) → warm alumni intros
 *
 * Writes data/anusha-company-intel.json after every company, so an interrupted
 * run resumes where it stopped. Uses the logged-in .browser-profile session.
 *
 * Usage:
 *   npx tsx scripts/anusha-company-crawl.ts                 # All companies not yet crawled
 *   npx tsx scripts/anusha-company-crawl.ts --limit 5       # At most 5 companies this run
 *   npx tsx scripts/anusha-company-crawl.ts --only Syngene  # Just companies matching a name
 *   npx tsx scripts/anusha-company-crawl.ts --refresh       # Re-crawl already-crawled companies
 *   npx tsx scripts/anusha-company-crawl.ts --jobs-only     # Re-fetch jobs for crawled companies (no people searches)
 */

import { loadEnv } from "../src/lib/pipeline/env";
loadEnv();

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { Page } from "playwright";

import { connectBrowser, verifyLinkedInLogin, buildJobsExtractJs } from "../src/lib/pipeline/browser";

const CONFIG_PATH = path.resolve(process.cwd(), "config", "anusha-companies.json");
const OUT_PATH = path.resolve(process.cwd(), "data", "anusha-company-intel.json");

// LinkedIn geoUrn ids for people-search location filters.
const GEO_URNS: Record<string, string> = {
  Bengaluru: "105214831",
  Hyderabad: "105556991",
};

// People searches per company. LinkedIn keyword search accepts boolean OR.
const PEOPLE_QUERIES: { role: string; keywords: string }[] = [
  { role: "Strategy / Intelligence", keywords: "intelligence OR insights OR strategy OR analytics" },
  { role: "Business Development", keywords: "\"business development\" OR commercial OR portfolio" },
  { role: "Talent Acquisition", keywords: "\"talent acquisition\" OR recruiter OR recruitment" },
];
const MAX_PEOPLE_PER_QUERY = 8;

interface CompanyConfig {
  name: string;
  search?: string;
  linkedin?: string;
  tier: number;
  cities: string[];
  type: string;
  hook: string;
  teams: string;
}

interface Person {
  name: string;
  degree: string;
  headline: string;
  location: string;
  current: string;
  profileUrl: string;
  role: string;
}

interface Job {
  title: string;
  location: string;
  posted: string;
  url: string;
  relevant: boolean;
}

interface CompanyIntel extends CompanyConfig {
  linkedinUrl: string | null;
  linkedinName?: string | null;
  linkedinId: string | null;
  website: string | null;
  careersUrl: string | null;
  industry: string | null;
  size: string | null;
  headquarters: string | null;
  jobsSearchUrl: string | null;
  jobsTotal: number;
  jobs: Job[];
  people: Person[];
  alumni: Person[];
  crawledAt: string;
  errors: string[];
}

class SearchLimitError extends Error {}

const args = process.argv.slice(2);
const argVal = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(argVal("--limit")) || Infinity;
const ONLY = argVal("--only")?.toLowerCase();
const REFRESH = args.includes("--refresh");
const JOBS_ONLY = args.includes("--jobs-only");

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const titleRe = new RegExp(`\\b(${(config.job_title_keywords as string[]).join("|")})`, "i");
const titleExcludeRe = new RegExp(`\\b(${(config.job_exclude_keywords as string[]).join("|")})`, "i");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Human-ish pacing between LinkedIn page loads.
const pause = () => sleep(6000 + Math.random() * 6000);

async function load(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  const text = await page.evaluate(`(document.querySelector("main") || document.body).innerText`) as string;
  // Past the free-tier cap, results show 3 names then "LinkedIn Member" placeholders.
  if (/commercial use limit|monthly limit for profile searches/i.test(text)) throw new SearchLimitError("LinkedIn monthly people-search limit reached");
  return text;
}

// ───── Company page ─────

async function resolveCompanyUrl(page: Page, query: string): Promise<string | null> {
  await load(page, `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query)}`);
  const href = await page.evaluate(`(function() {
    var a = document.querySelector('main a[href*="/company/"]');
    return a ? a.href : null;
  })()`) as string | null;
  if (!href) return null;
  const m = href.match(/linkedin\.com\/company\/[^/?#]+/);
  return m ? `https://www.${m[0]}/` : null;
}

function fieldAfter(lines: string[], label: string): string | null {
  const i = lines.indexOf(label);
  return i >= 0 && lines[i + 1] ? lines[i + 1] : null;
}

async function readAbout(page: Page, companyUrl: string) {
  const text = await load(page, `${companyUrl}about/`);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const idHref = await page.evaluate(`(function() {
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var m = decodeURIComponent(links[i].href).match(/currentCompany=\\[?"?(\\d+)/);
      if (m) return m[1];
    }
    return null;
  })()`) as string | null;
  return {
    linkedinId: idHref,
    linkedinName: lines[0] || null,
    website: fieldAfter(lines, "Website"),
    industry: fieldAfter(lines, "Industry"),
    size: fieldAfter(lines, "Company size"),
    headquarters: fieldAfter(lines, "Headquarters"),
  };
}

// ───── Careers page (company website, not LinkedIn) ─────

async function findCareersUrl(website: string): Promise<string | null> {
  try {
    const res = await fetch(website, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    const html = await res.text();
    const hrefs = Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi), (m) => m[1]);
    const hit = hrefs.find((h) => /career|jobs|join-?us|work-with-us/i.test(h));
    return hit ? new URL(hit, res.url).toString() : null;
  } catch {
    return null;
  }
}

// ───── Jobs ─────

// First distinctive word of a company name, used to spot LinkedIn's
// "recommended jobs" filler from other companies when a company has no openings.
function companyToken(name: string): string {
  return (name.toLowerCase().split(/[\s/,.()]+/).find((w) => w.length > 3) || name).toLowerCase();
}

async function readJobs(page: Page, companyId: string, companyName: string) {
  const url = `https://www.linkedin.com/jobs/search/?f_C=${companyId}&location=India`;
  await load(page, url);
  const raw = JSON.parse(await page.evaluate(`(${buildJobsExtractJs(3)})()`) as string);
  const token = companyToken(companyName);
  const blocks = raw.blocks.filter((b: { cardText: string }) =>
    (b.cardText.split("\n").map((l) => l.trim()).filter(Boolean)[1] || "").toLowerCase().includes(token),
  );
  const jobs: Job[] = blocks.map((b: { jobUrl: string; cardText: string }) => {
    const lines = b.cardText.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || "";
    return {
      title,
      location: lines[2] || "",
      posted: lines.find((l) => /\bago$/.test(l)) || "",
      url: new URL(b.jobUrl, "https://www.linkedin.com").toString(),
      relevant: titleRe.test(title) && !titleExcludeRe.test(title),
    };
  });
  return { url, jobs };
}

// ───── People ─────

const PEOPLE_EXTRACT_JS = `(async function() {
  var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  window.scrollTo(0, document.body.scrollHeight);
  await delay(1500);
  var main = document.querySelector("main") || document.body;
  var anchors = main.querySelectorAll('a[href*="/in/"]');
  var cards = [];
  for (var i = 0; i < anchors.length; i++) {
    var c = anchors[i];
    for (var j = 0; j < 10 && c.parentElement; j++) {
      c = c.parentElement;
      if (c.tagName === "LI" || (c.innerText || "").split("\\n").length > 4) break;
    }
    if (cards.indexOf(c) === -1) cards.push(c);
  }
  return JSON.stringify(cards.map(function(card) {
    var a = card.querySelector('a[href*="/in/"]');
    return { href: a ? a.href.split("?")[0] : "", text: card.innerText || "" };
  }));
})()`;

function parsePersonCard(card: { href: string; text: string }, role: string): Person | null {
  const lines = card.text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!card.href || lines.length < 2) return null;
  // Degree renders either inline ("Name • 2nd", "Name 3rd+") or on its own line ("• 2nd").
  const degreeRe = /\s*•?\s*(\d(?:st|nd|rd|th)\+?)\s*$/;
  let degree = (lines[0].match(degreeRe) || [])[1] || "";
  const name = lines[0].replace(degreeRe, "").replace(/•\s*$/, "").trim();
  let rest = lines.slice(1);
  if (rest[0] && /^•/.test(rest[0])) {
    degree = degree || (rest[0].match(degreeRe) || [])[1] || "";
    rest = rest.slice(1);
  }
  if (!name || /linkedin member/i.test(name)) return null;
  const [headline = "", location = ""] = rest.filter((l) => !/^(Current|Past|Summary):/.test(l));
  const current = (lines.find((l) => /^Current:/.test(l)) || "").replace(/^Current:\s*/, "");
  return { name, degree, headline, location, current, profileUrl: card.href, role };
}

async function searchPeople(page: Page, params: Record<string, string>, role: string): Promise<Person[]> {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const text = await load(page, `https://www.linkedin.com/search/results/people/?${qs}`);
  if (/No results found/i.test(text)) return [];
  const cards = JSON.parse(await page.evaluate(PEOPLE_EXTRACT_JS) as string);
  const seen = new Set<string>();
  return cards
    .map((c: { href: string; text: string }) => parsePersonCard(c, role))
    .filter((p: Person | null): p is Person => p !== null && !seen.has(p.profileUrl) && !!seen.add(p.profileUrl))
    .slice(0, MAX_PEOPLE_PER_QUERY);
}

// ───── Main ─────

async function crawlCompany(page: Page, c: CompanyConfig, alumniIds: string[]): Promise<CompanyIntel> {
  const intel: CompanyIntel = {
    ...c,
    linkedinUrl: null, linkedinId: null, website: null, careersUrl: null,
    industry: null, size: null, headquarters: null,
    jobsSearchUrl: null, jobsTotal: 0, jobs: [], people: [], alumni: [],
    crawledAt: new Date().toISOString(), errors: [],
  };

  intel.linkedinUrl = c.linkedin || await resolveCompanyUrl(page, c.search || c.name);
  if (!intel.linkedinUrl) {
    intel.errors.push("company page not found");
    return intel;
  }
  await pause();
  Object.assign(intel, await readAbout(page, intel.linkedinUrl));
  if (intel.website) intel.careersUrl = await findCareersUrl(intel.website);
  if (!intel.linkedinId) {
    intel.errors.push("company id not found — skipped jobs and people");
    return intel;
  }
  const companyFilter = JSON.stringify([intel.linkedinId]);

  await pause();
  try {
    const { url, jobs } = await readJobs(page, intel.linkedinId, intel.linkedinName || c.name);
    intel.jobsSearchUrl = url;
    intel.jobsTotal = jobs.length;
    intel.jobs = jobs.sort((a, b) => Number(b.relevant) - Number(a.relevant));
  } catch (e) {
    if (e instanceof SearchLimitError) throw e;
    intel.errors.push(`jobs: ${(e as Error).message}`);
  }

  const geo = JSON.stringify(c.cities.map((city) => GEO_URNS[city]).filter(Boolean));
  const seen = new Set<string>();
  for (const q of PEOPLE_QUERIES) {
    await pause();
    try {
      const found = await searchPeople(page, { currentCompany: companyFilter, geoUrn: geo, keywords: q.keywords }, q.role);
      for (const p of found) {
        if (seen.has(p.profileUrl)) continue;
        seen.add(p.profileUrl);
        intel.people.push(p);
      }
    } catch (e) {
      if (e instanceof SearchLimitError) throw e;
      intel.errors.push(`people (${q.role}): ${(e as Error).message}`);
    }
  }

  const otherAlumni = alumniIds.filter((id) => id !== intel.linkedinId);
  if (otherAlumni.length) {
    await pause();
    try {
      intel.alumni = await searchPeople(
        page,
        { currentCompany: companyFilter, pastCompany: JSON.stringify(otherAlumni) },
        "Ex-Bharat Biotech",
      );
    } catch (e) {
      if (e instanceof SearchLimitError) throw e;
      intel.errors.push(`alumni: ${(e as Error).message}`);
    }
  }

  return intel;
}

async function main() {
  const saved = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, "utf-8")) : {};
  const existing: Record<string, CompanyIntel> = saved.companies || {};
  const alumniIdCache: Record<string, string> = saved.alumniIds || {};
  const save = () => {
    mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), alumniIds: alumniIdCache, companies: existing }, null, 2));
  };

  if (JOBS_ONLY) {
    const targets = Object.values(existing)
      .filter((c) => c.linkedinId && (!ONLY || c.name.toLowerCase().includes(ONLY)))
      .slice(0, LIMIT);
    console.log(`Refreshing jobs for ${targets.length} companies\n`);
    const { page, close } = await connectBrowser();
    try {
      await verifyLinkedInLogin(page);
      for (const [i, intel] of targets.entries()) {
        const { url, jobs } = await readJobs(page, intel.linkedinId!, intel.linkedinName || intel.name);
        intel.jobsSearchUrl = url;
        intel.jobsTotal = jobs.length;
        intel.jobs = jobs.sort((a, b) => Number(b.relevant) - Number(a.relevant));
        save();
        console.log(`[${i + 1}/${targets.length}] ${intel.name}: jobs ${jobs.filter((j) => j.relevant).length}/${jobs.length} relevant`);
        await pause();
      }
    } finally {
      await close();
    }
    return;
  }

  const queue = (config.companies as CompanyConfig[])
    .filter((c) => !ONLY || c.name.toLowerCase().includes(ONLY))
    .filter((c) => REFRESH || ONLY || !existing[c.name])
    .slice(0, LIMIT);
  console.log(`${queue.length} companies to crawl (${Object.keys(existing).length} already in ${path.relative(process.cwd(), OUT_PATH)})\n`);
  if (!queue.length) return;

  const { page, close } = await connectBrowser();
  try {
    await verifyLinkedInLogin(page);

    // Past-employer ids for the alumni search, resolved once and cached in the output file.
    for (const name of config.alumni_companies as string[]) {
      if (alumniIdCache[name]) continue;
      const url = await resolveCompanyUrl(page, name);
      if (url) {
        await pause();
        const { linkedinId } = await readAbout(page, url);
        if (linkedinId) alumniIdCache[name] = linkedinId;
      }
      await pause();
    }
    const alumniIds = Object.values(alumniIdCache);
    console.log(`Alumni company ids: ${alumniIds.join(", ") || "none"}\n`);

    for (const [i, c] of queue.entries()) {
      console.log(`[${i + 1}/${queue.length}] ${c.name}`);
      const intel = await crawlCompany(page, c, alumniIds);
      existing[c.name] = intel;
      save();
      const relevant = intel.jobs.filter((j) => j.relevant).length;
      console.log(
        `  ${intel.website || "no website"} | jobs ${relevant}/${intel.jobsTotal} relevant | ` +
        `people ${intel.people.length} | alumni ${intel.alumni.length}` +
        (intel.errors.length ? ` | errors: ${intel.errors.join("; ")}` : ""),
      );
      await pause();
    }
  } catch (e) {
    if (e instanceof SearchLimitError) {
      console.error(`\n${e.message}. Progress saved — rerun later to continue.`);
    } else {
      throw e;
    }
  } finally {
    await close();
  }
}

main();
