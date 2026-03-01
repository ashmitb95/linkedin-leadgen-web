/**
 * lead-run.ts — Lead gen pipeline runner.
 *
 * Connects to browser via CDP, runs keyword searches on LinkedIn,
 * extracts and scores leads via Claude, stores in Turso.
 *
 * Usage:
 *   npx tsx scripts/lead-run.ts                    # Full run
 *   npx tsx scripts/lead-run.ts --max 2            # Limit searches per mode
 *   npx tsx scripts/lead-run.ts --keyword "test"   # Single keyword test
 *   npx tsx scripts/lead-run.ts --content-only     # Only content search
 *   npx tsx scripts/lead-run.ts --salesnav-only    # Only Sales Nav search
 *   npx tsx scripts/lead-run.ts --branding-only    # Only branding keywords
 *   npx tsx scripts/lead-run.ts --dev-only         # Only dev keywords
 */

import { loadEnv } from "../src/lib/pipeline/env";
loadEnv();

import { readFileSync } from "fs";
import path from "path";

import {
  connectBrowser,
  verifyLinkedInLogin,
  CONTENT_SCROLL_AND_EXTRACT,
  SALESNAV_SCROLL_AND_EXTRACT,
  buildContentSearchUrl,
  buildSalesNavSearchUrl,
  type SearchJob,
} from "../src/lib/pipeline/browser";
import { extractAndScore } from "../src/lib/pipeline/extract";
import {
  upsertLead,
  logRunStart,
  logRunEnd,
  hashPostContent,
  getSeenPostHashes,
  markPostsSeen,
} from "../src/lib/pipeline/db-ops";
import { enrichLeadsWithVoyager } from "../src/lib/pipeline/enrich";
import { absUrl, extractPublicProfileUrl } from "../src/lib/url-utils";
import { getLeadDigest } from "../src/lib/leads";

const CONFIG_PATH = path.resolve(process.cwd(), "config", "keywords.json");

interface RunStats {
  searchesRun: number;
  blocksFound: number;
  leadsScored: number;
  leadsNew: number;
  errors: string[];
}

async function runSearch(
  page: import("playwright").Page,
  context: import("playwright").BrowserContext,
  job: SearchJob,
  stats: RunStats,
  knownHashes: Set<string>,
  seenInRun: Set<string>
): Promise<void> {
  const shortKeyword =
    job.keyword.length > 50 ? job.keyword.slice(0, 50) + "..." : job.keyword;
  const modeLabel = job.mode === "sales_nav" ? "SN" : "Content";
  console.log(`  [${modeLabel}] Searching: ${shortKeyword}`);

  try {
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(4000);

    console.log("    Scrolling and extracting...");
    const blocksJson = await page.evaluate(`(${job.extractJs})()`);
    const parsed = JSON.parse(blocksJson as string);
    const blocks: { profileUrl: string; cardText: string; links: { text: string; href: string }[] }[] =
      Array.isArray(parsed) ? parsed : parsed.blocks || [];
    stats.blocksFound += blocks.length;
    console.log(`    Found ${blocks.length} result blocks (${parsed.scrolls || 0} scrolls)`);

    if (blocks.length === 0) {
      console.log("    No results — skipping scoring");
      stats.searchesRun++;
      return;
    }

    // Filter already-seen posts
    const filtered = blocks.filter((b) => {
      const hash = hashPostContent(b.profileUrl, b.cardText);
      if (knownHashes.has(hash) || seenInRun.has(hash)) return false;
      seenInRun.add(hash);
      return true;
    });
    const skipped = blocks.length - filtered.length;
    if (skipped > 0) console.log(`    Skipped ${skipped} already-seen posts`);

    if (filtered.length === 0) {
      console.log("    All posts already seen — skipping scoring");
      stats.searchesRun++;
      return;
    }

    // Score leads via Claude
    const filteredJson = JSON.stringify({
      blocks: filtered,
      scrolls: parsed.scrolls || 0,
      total: filtered.length,
    });
    console.log(`    Scoring ${filtered.length} new blocks with Claude...`);
    const leads = await extractAndScore(filteredJson, job.keyword, job.mode as "content" | "sales_nav");
    console.log(`    ${leads.length} qualified leads`);
    stats.leadsScored += leads.length;

    // Upsert to Turso
    const now = new Date().toISOString();
    for (const lead of leads) {
      // Extract public profile URL for Sales Nav leads
      const publicProfileUrl = lead.publicProfileUrl ||
        extractPublicProfileUrl(lead.profileUrl, filtered.find((b) => b.profileUrl === lead.profileUrl)?.links);

      const { isNew } = await upsertLead({
        name: lead.name,
        headline: lead.headline,
        company: lead.company,
        profile_url: absUrl(lead.profileUrl),
        public_profile_url: publicProfileUrl,
        post_content: lead.postContent,
        post_url: lead.postUrl || "",
        keyword_match: `[${modeLabel}] ${lead.keywordMatch}`,
        tier: lead.tier,
        relevance: lead.relevance,
        urgency: lead.urgency,
        draft_message: lead.draftMessage,
        found_at: now,
        contact_email: lead.contactEmail || "",
        contact_info: lead.contactInfo || "",
        post_date: lead.postDate || "",
      });
      if (isNew) stats.leadsNew++;
    }

    // Enrich via Voyager API
    if (leads.length > 0) {
      console.log(`    Enriching ${leads.length} leads via Voyager API...`);
      await enrichLeadsWithVoyager(context, leads.map((l) => ({ profileUrl: l.profileUrl })));
    }

    // Mark blocks as seen
    await markPostsSeen(
      filtered.map((b) => ({
        contentHash: hashPostContent(b.profileUrl, b.cardText),
        profileUrl: b.profileUrl,
      }))
    );

    stats.searchesRun++;
  } catch (err) {
    const msg = `[${modeLabel}] "${shortKeyword}" failed: ${(err as Error).message}`;
    console.error(`    ERROR: ${msg}`);
    stats.errors.push(msg);
    stats.searchesRun++;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const maxIdx = args.indexOf("--max");
  const maxSearches = maxIdx >= 0 ? Number(args[maxIdx + 1]) : undefined;
  const singleKeywordIdx = args.indexOf("--keyword");
  const singleKeyword = singleKeywordIdx >= 0 ? args[singleKeywordIdx + 1] : null;
  const contentOnly = args.includes("--content-only");
  const salesnavOnly = args.includes("--salesnav-only");
  const brandingOnly = args.includes("--branding-only");
  const devOnly = args.includes("--dev-only");

  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

  function selectKeywords(section: { keywords?: string[]; branding_keywords?: string[] }): string[] {
    const dev = section.keywords || [];
    const branding = section.branding_keywords || [];
    if (brandingOnly) return branding;
    if (devOnly) return dev;
    return [...dev, ...branding];
  }

  const jobs: SearchJob[] = [];

  if (singleKeyword) {
    jobs.push({
      keyword: singleKeyword,
      mode: "content",
      url: buildContentSearchUrl(singleKeyword),
      extractJs: CONTENT_SCROLL_AND_EXTRACT,
    });
  } else {
    if (!salesnavOnly) {
      const contentKeywords = selectKeywords(config.content_search || {});
      const contentMax = maxSearches || config.content_search?.max_per_run || 6;
      for (const kw of contentKeywords.slice(0, contentMax)) {
        jobs.push({
          keyword: kw,
          mode: "content",
          url: buildContentSearchUrl(kw),
          extractJs: CONTENT_SCROLL_AND_EXTRACT,
        });
      }
    }

    if (!contentOnly) {
      const snKeywords = selectKeywords(config.sales_nav_search || {});
      const snMax = maxSearches || config.sales_nav_search?.max_per_run || 4;
      for (const kw of snKeywords.slice(0, snMax)) {
        jobs.push({
          keyword: kw,
          mode: "sales_nav",
          url: buildSalesNavSearchUrl(kw),
          extractJs: SALESNAV_SCROLL_AND_EXTRACT,
        });
      }
    }
  }

  const contentCount = jobs.filter((j) => j.mode === "content").length;
  const snCount = jobs.filter((j) => j.mode === "sales_nav").length;

  console.log(`\n=== LinkedIn Lead Gen Run ===`);
  console.log(`Content searches: ${contentCount}`);
  console.log(`Sales Nav searches: ${snCount}`);
  console.log(`Total: ${jobs.length}`);

  const { context, page, close } = await connectBrowser();
  await verifyLinkedInLogin(page);

  const stats: RunStats = {
    searchesRun: 0,
    blocksFound: 0,
    leadsScored: 0,
    leadsNew: 0,
    errors: [],
  };

  const runId = await logRunStart();

  const knownHashes = await getSeenPostHashes();
  const seenInRun = new Set<string>();
  console.log(`Loaded ${knownHashes.size} previously seen post hashes\n`);

  for (let i = 0; i < jobs.length; i++) {
    console.log(`[${i + 1}/${jobs.length}]`);
    await runSearch(page, context, jobs[i], stats, knownHashes, seenInRun);

    if (i < jobs.length - 1) {
      console.log("    Waiting 5s...\n");
      await page.waitForTimeout(5000);
    }
  }

  await logRunEnd(runId, {
    searches_run: stats.searchesRun,
    leads_found: stats.leadsScored,
    leads_new: stats.leadsNew,
  });

  await close();

  console.log("\n=== Run Complete ===");
  console.log(`Searches: ${stats.searchesRun}/${jobs.length}`);
  console.log(`Blocks found: ${stats.blocksFound}`);
  console.log(`Leads scored: ${stats.leadsScored}`);
  console.log(`New leads: ${stats.leadsNew}`);
  if (stats.errors.length > 0) {
    console.log(`Errors: ${stats.errors.length}`);
    for (const e of stats.errors) console.log(`  - ${e}`);
  }

  const digest = await getLeadDigest();
  console.log("\n" + digest);
}

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
