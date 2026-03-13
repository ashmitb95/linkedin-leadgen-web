/**
 * sourav-job-run.ts — Job search pipeline for Sourav.
 *
 * Same multi-source pipeline as job-run.ts but uses Sourav's config/profile
 * and writes to sourav_jobs/sourav_job_runs tables.
 *
 * Usage:
 *   npx tsx scripts/sourav-job-run.ts                    # Full run
 *   npx tsx scripts/sourav-job-run.ts --quick            # Smoke test
 *   npx tsx scripts/sourav-job-run.ts --max 2            # Limit searches
 *   npx tsx scripts/sourav-job-run.ts --content-only     # Only LinkedIn hiring posts
 *   npx tsx scripts/sourav-job-run.ts --jobs-only        # Only LinkedIn job listings
 *   npx tsx scripts/sourav-job-run.ts --naukri-only      # Only Naukri.com
 *   npx tsx scripts/sourav-job-run.ts --boards-only      # Only Naukri + Hirist
 *   npx tsx scripts/sourav-job-run.ts --linkedin-only    # Only LinkedIn
 */

import { loadEnv } from "../src/lib/pipeline/env";
loadEnv();

import { readFileSync } from "fs";
import path from "path";

import {
  connectBrowser,
  verifyLinkedInLogin,
  buildContentExtractJs,
  buildJobsExtractJs,
  buildNaukriExtractJs,
  buildHiristExtractJs,
  buildContentSearchUrl,
  buildJobsSearchUrl,
  buildNaukriSearchUrl,
  buildHiristSearchUrl,
  type SearchJob,
} from "../src/lib/pipeline/browser";
import { extractAndScoreJobs } from "../src/lib/pipeline/job-extract";
import { souravJobOps } from "../src/lib/pipeline/db-ops";
import { souravJobsDb } from "../src/lib/jobs";

const CONFIG_PATH = path.resolve(process.cwd(), "config", "sourav-job-keywords.json");
const PROFILE_PATH = path.resolve(process.cwd(), "config", "sourav-job-profile.json");
const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf-8"));

interface RunStats {
  searchesRun: number;
  blocksFound: number;
  jobsScored: number;
  jobsNew: number;
  errors: string[];
}

async function runSearch(
  page: import("playwright").Page,
  job: SearchJob,
  stats: RunStats
): Promise<void> {
  const shortKeyword = job.keyword.length > 50 ? job.keyword.slice(0, 50) + "..." : job.keyword;
  const modeLabels: Record<string, string> = { content: "Content", jobs: "Jobs", naukri: "Naukri", hirist: "Hirist" };
  const modeLabel = modeLabels[job.mode] || job.mode;
  console.log(`  [${modeLabel}] Searching: ${shortKeyword}`);

  try {
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(4000);

    console.log("    Extracting...");
    const blocksJson = await page.evaluate(`(${job.extractJs})()`);
    const parsed = JSON.parse(blocksJson as string);
    const blockCount = parsed.total || 0;
    stats.blocksFound += blockCount;
    console.log(`    Found ${blockCount} result blocks`);

    if (blockCount === 0) {
      console.log("    No results — skipping scoring");
      stats.searchesRun++;
      return;
    }

    console.log("    Scoring with Claude (Sourav profile)...");
    const scoredJobs = await extractAndScoreJobs(blocksJson as string, job.keyword, job.mode as any, profile);
    console.log(`    ${scoredJobs.length} matching jobs`);
    stats.jobsScored += scoredJobs.length;

    const now = new Date().toISOString();
    for (const j of scoredJobs) {
      const dedupKey = job.mode === "jobs"
        ? j.jobUrl || `${j.company}|${j.title}`
        : `${j.company}|${j.title}|${j.posterUrl}`;

      const { isNew } = await souravJobOps.upsertJob({
        dedup_key: dedupKey,
        source: job.mode,
        title: j.title,
        company: j.company,
        location: j.location,
        work_mode: j.workMode,
        salary_range: j.salaryRange,
        job_url: j.jobUrl,
        apply_url: j.applyUrl,
        job_description: j.jobDescription,
        recruiter_name: j.recruiterName,
        recruiter_email: j.recruiterEmail,
        recruiter_url: j.recruiterUrl,
        poster_name: j.posterName,
        poster_headline: j.posterHeadline,
        poster_url: j.posterUrl,
        post_content: j.postContent,
        post_url: j.postUrl,
        fit_score: j.fitScore,
        stack_match: j.stackMatch,
        seniority_match: j.seniorityMatch,
        urgency: j.urgency,
        reasoning: j.reasoning,
        draft_message: j.draftMessage,
        keyword_match: `[${modeLabel}] ${j.keywordMatch}`,
        found_at: now,
      });
      if (isNew) stats.jobsNew++;
    }

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
  const scrollsIdx = args.indexOf("--scrolls");
  const scrollsOverride = scrollsIdx >= 0 ? Number(args[scrollsIdx + 1]) : undefined;
  const singleKeywordIdx = args.indexOf("--keyword");
  const singleKeyword = singleKeywordIdx >= 0 ? args[singleKeywordIdx + 1] : null;
  const contentOnly = args.includes("--content-only");
  const jobsOnly = args.includes("--jobs-only");
  const naukriOnly = args.includes("--naukri-only");
  const hiristOnly = args.includes("--hirist-only");
  const boardsOnly = args.includes("--boards-only");
  const linkedinOnly = args.includes("--linkedin-only");
  const quick = args.includes("--quick");

  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  const quickCfg = config.quick || {};

  const contentScrolls = scrollsOverride || (quick ? quickCfg.max_scrolls : null) || config.content_search?.max_scrolls || 6;
  const jobsScrolls = scrollsOverride || (quick ? quickCfg.max_scrolls : null) || config.jobs_search?.max_scrolls || 8;
  const hiristScrolls = scrollsOverride || (quick ? quickCfg.max_scrolls : null) || config.hirist?.max_scrolls || 3;
  const naukriPages = (quick ? 1 : null) || config.naukri?.max_pages || config.naukri?.max_scrolls || 3;
  const delayMs = quick ? (quickCfg.search_delay_ms || 2000) : (config.search_delay_ms || 5000);

  const contentExtractJs = buildContentExtractJs(contentScrolls);
  const jobsExtractJs = buildJobsExtractJs(jobsScrolls);
  const naukriExtractJs = buildNaukriExtractJs();
  const hiristExtractJs = buildHiristExtractJs(hiristScrolls);

  const searchJobs: SearchJob[] = [];

  const singleSource = contentOnly || jobsOnly || naukriOnly || hiristOnly;
  const runLinkedin = !boardsOnly && !naukriOnly && !hiristOnly;
  const runBoards = !linkedinOnly && !contentOnly && !jobsOnly;

  if (singleKeyword) {
    searchJobs.push({
      keyword: singleKeyword,
      mode: "content",
      url: buildContentSearchUrl(singleKeyword),
      extractJs: contentExtractJs,
    });
  } else {
    if (runLinkedin && (!singleSource || contentOnly)) {
      const contentKeywords = config.content_search?.keywords || [];
      const contentMax = maxSearches || (quick ? (quickCfg.max_per_run || 1) : null) || config.content_search?.max_per_run || 8;
      for (const kw of contentKeywords.slice(0, contentMax)) {
        searchJobs.push({ keyword: kw, mode: "content", url: buildContentSearchUrl(kw), extractJs: contentExtractJs });
      }
    }

    if (runLinkedin && (!singleSource || jobsOnly)) {
      const jobsKeywords = config.jobs_search?.keywords || [];
      const jobsMax = maxSearches || (quick ? (quickCfg.max_per_run || 1) : null) || config.jobs_search?.max_per_run || 4;
      const filters = config.jobs_search?.filters;
      for (const kw of jobsKeywords.slice(0, jobsMax)) {
        searchJobs.push({ keyword: kw, mode: "jobs", url: buildJobsSearchUrl(kw, filters), extractJs: jobsExtractJs });
      }
    }

    // Naukri: paginated — create one search job per keyword per page
    if (runBoards && (!singleSource || naukriOnly) && config.naukri?.enabled !== false) {
      const naukriKeywords = config.naukri?.keywords || [];
      const naukriMax = maxSearches || (quick ? (quickCfg.max_per_run || 1) : null) || config.naukri?.max_per_run || 4;
      const naukriFilters = config.naukri?.filters;
      for (const kw of naukriKeywords.slice(0, naukriMax)) {
        for (let pg = 1; pg <= naukriPages; pg++) {
          searchJobs.push({
            keyword: pg > 1 ? `${kw} (p${pg})` : kw,
            mode: "naukri",
            url: buildNaukriSearchUrl(kw, naukriFilters, pg),
            extractJs: naukriExtractJs,
          });
        }
      }
    }

    if (runBoards && (!singleSource || hiristOnly) && config.hirist?.enabled !== false) {
      const hiristKeywords = config.hirist?.keywords || [];
      const hiristMax = maxSearches || (quick ? (quickCfg.max_per_run || 1) : null) || config.hirist?.max_per_run || 3;
      for (const kw of hiristKeywords.slice(0, hiristMax)) {
        searchJobs.push({ keyword: kw, mode: "hirist", url: buildHiristSearchUrl(kw), extractJs: hiristExtractJs });
      }
    }
  }

  const contentCount = searchJobs.filter((j) => j.mode === "content").length;
  const jobsCount = searchJobs.filter((j) => j.mode === "jobs").length;
  const naukriCount = searchJobs.filter((j) => j.mode === "naukri").length;
  const hiristCount = searchJobs.filter((j) => j.mode === "hirist").length;
  const modeLabel = quick ? "QUICK" : "FULL";

  console.log(`\n=== Sourav — Job Search Run [${modeLabel}] ===`);
  console.log(`Profile: ${profile.name || "Sourav"} — Shipping/Logistics/Freight Forwarding`);
  console.log(`LinkedIn Content: ${contentCount} | LinkedIn Jobs: ${jobsCount}`);
  console.log(`Naukri: ${naukriCount} (${naukriPages} pages/keyword) | Hirist: ${hiristCount}`);
  console.log(`Delay: ${delayMs}ms | Total searches: ${searchJobs.length}`);

  const { page, close } = await connectBrowser();
  await verifyLinkedInLogin(page);

  const stats: RunStats = {
    searchesRun: 0,
    blocksFound: 0,
    jobsScored: 0,
    jobsNew: 0,
    errors: [],
  };

  const runId = await souravJobOps.logJobRunStart();

  for (let i = 0; i < searchJobs.length; i++) {
    console.log(`[${i + 1}/${searchJobs.length}]`);
    await runSearch(page, searchJobs[i], stats);

    if (i < searchJobs.length - 1) {
      console.log(`    Waiting ${delayMs / 1000}s...\n`);
      await page.waitForTimeout(delayMs);
    }
  }

  await souravJobOps.logJobRunEnd(runId, {
    searches_run: stats.searchesRun,
    jobs_found: stats.jobsScored,
    jobs_new: stats.jobsNew,
  });

  await close();

  console.log("\n=== Sourav — Run Complete ===");
  console.log(`Searches: ${stats.searchesRun}/${searchJobs.length}`);
  console.log(`Blocks found: ${stats.blocksFound}`);
  console.log(`Jobs scored: ${stats.jobsScored}`);
  console.log(`New jobs: ${stats.jobsNew}`);
  if (stats.errors.length > 0) {
    console.log(`Errors: ${stats.errors.length}`);
    for (const e of stats.errors) console.log(`  - ${e}`);
  }

  const digest = await souravJobsDb.getJobDigest();
  console.log("\n" + digest);
}

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
