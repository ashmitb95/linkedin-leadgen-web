/**
 * job-extract.ts — Job scoring via Claude.
 *
 * Supports custom profiles via optional parameter to extractAndScoreJobs().
 * Default uses config/job-profile.json.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import path from "path";
import { repairJson } from "./json-utils";

const CONFIG_DIR = path.resolve(process.cwd(), "config");
const DEFAULT_PROFILE_PATH = path.join(CONFIG_DIR, "job-profile.json");

let defaultProfile: any;
try {
  defaultProfile = JSON.parse(readFileSync(DEFAULT_PROFILE_PATH, "utf-8"));
} catch {
  defaultProfile = {};
}

export interface ScoredJob {
  title: string;
  company: string;
  location: string;
  workMode: "remote" | "hybrid" | "onsite" | "unknown";
  salaryRange: string | null;
  jobUrl: string;
  applyUrl: string;
  jobDescription: string;
  recruiterName: string;
  recruiterEmail: string;
  recruiterUrl: string;
  posterName: string;
  posterHeadline: string;
  posterUrl: string;
  postContent: string;
  postUrl: string;
  fitScore: number;
  stackMatch: number;
  seniorityMatch: "exact" | "close" | "mismatch";
  urgency: "high" | "medium" | "low";
  reasoning: string;
  draftMessage: string;
  domain: string;
  domainMatch: number;
  keywordMatch: string;
  // Enhanced (opt-in) breakdown — present only when scored in enhanced mode.
  domainFit?: number;
  roleFit?: number;
  seniorityFit?: number;
  locationFit?: number;
  mustHaves?: { requirement: string; met: boolean }[];
  gaps?: string[];
}

export interface ScoreOptions {
  /** Use the decomposed rubric and compute a calibrated fitScore from sub-scores. */
  enhanced?: boolean;
  /** Full résumé text to ground scoring against real experience (not just the JSON profile). */
  resumeText?: string;
}

const clamp01 = (n: number) => (typeof n === "number" && !Number.isNaN(n) ? Math.max(0, Math.min(1, n)) : 0);

/**
 * Extra instructions appended in enhanced mode: ask the model for explainable
 * sub-scores + a requirements checklist instead of a single opaque number.
 */
function enhancedScoringBlock(): string {
  return `ADDITIONAL SCORING — for EACH job object, ALSO include these fields. They are used to compute a calibrated, explainable fit score, so be honest and specific:
- **domainFit** (0.0-1.0): How well the role's industry/domain matches the candidate's target domains.
- **roleFit** (0.0-1.0): How well the job title and core responsibilities match the candidate's target roles and actual experience.
- **seniorityFit** (0.0-1.0): How well the role's level / experience requirement matches the candidate's seniority.
- **locationFit** (0.0-1.0): 1.0 if clearly eligible/located for the candidate, lower if uncertain, 0.0 if ineligible.
- **mustHaves**: An array of the job's 4-6 most important requirements. Each item is { "requirement": "<short phrase>", "met": true|false }, judged against the candidate's résumé/profile. Mark met:false when the evidence is genuinely absent — do not be generous.
- **gaps**: An array of short strings naming the most important UNMET requirements. [] if none.
- **reasoning**: 1-2 plain-language sentences a non-technical person can read. Name one concrete strength and the main gap. No jargon.

Still return ONLY a valid JSON array. No markdown, no code blocks.`;
}

/**
 * Normalize and attach the enhanced breakdown for display. Leaves fitScore and
 * stackMatch exactly as the model returned them (no weighted recompute).
 */
function attachBreakdown(job: ScoredJob): ScoredJob {
  const mustHaves = Array.isArray(job.mustHaves)
    ? job.mustHaves.filter((m) => m && typeof m.requirement === "string")
    : [];
  return {
    ...job,
    domainFit: clamp01(job.domainFit ?? job.domainMatch ?? 0),
    roleFit: clamp01(job.roleFit ?? 0),
    seniorityFit: clamp01(job.seniorityFit ?? 0),
    locationFit: clamp01(job.locationFit ?? 1),
    mustHaves,
    gaps: Array.isArray(job.gaps) ? job.gaps : [],
  };
}

/**
 * Domain classification instructions, injected into every scoring prompt.
 * When the profile lists target domains, constrain output to that set (plus
 * "Adjacent" / "Off-domain") so the dashboard can reliably filter on it.
 */
function domainInstructions(profile: any): string {
  const domains: string[] = Array.isArray(profile.domain) ? profile.domain : [];
  if (domains.length > 0) {
    const list = domains.map((d) => `"${d}"`).join(", ");
    return `- **domain**: The role's industry vertical. Pick the SINGLE best match from this exact list: ${list}. Use "Adjacent" if related but not core, or "Off-domain" if unrelated to these fields. Return one of these exact strings.
- **domainMatch** (0.0-1.0): How closely the role's industry aligns with the candidate's target domains. 1.0 = core domain from the list, ~0.5 = adjacent, 0.0 = unrelated.`;
  }
  return `- **domain**: The role's industry vertical in 1-3 words (e.g. "Fintech", "Healthcare", "E-commerce", "SaaS").
- **domainMatch** (0.0-1.0): How closely the role's domain aligns with the candidate's background.`;
}

function buildHiringPostPrompt(profile: any): string {
  return `You are parsing structured text blocks extracted from LinkedIn content search results. Each block represents a post where someone is announcing a job opening or sharing that their company is hiring.

Each block has:
- profileUrl: the poster's LinkedIn profile URL
- cardText: the raw visible text of their post card
- links: any links found in the card

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

From each block, extract:
- **title**: The job title being hired for (infer from post content)
- **company**: The company hiring (from poster's headline or post text)
- **location**: Extract ANY city, state, country, or region mentioned anywhere in the post text or job description (e.g. "Bangalore, India", "Hyderabad", "Remote - India"). If multiple locations mentioned, list them. Use "Not specified" ONLY if truly no location appears anywhere in the text.
- **workMode**: ONLY set to "remote" if the text explicitly says "remote", "work from home", "WFH", or "fully remote". If a physical location is mentioned without explicit remote language, use "onsite". If both a location AND remote/hybrid are mentioned, use "hybrid". Use "unknown" if no work mode clues exist. Do NOT default to "remote".
- **salaryRange**: If mentioned, extract it (INR or USD). Otherwise null
- **jobUrl**: If the post links to a job listing URL (/jobs/view/...), use it. Otherwise ""
- **applyUrl**: If any link points to a direct application page (careers site, lever, greenhouse, workable, etc.), extract it. Otherwise ""
- **jobDescription**: Key requirements/responsibilities mentioned (summarize in 2-3 sentences)
- **recruiterName**: If the post mentions a hiring manager, recruiter, or says "DM me" / "reach out to [name]" / "contact [name]", extract that person's name. If the poster IS the recruiter/hiring manager, use their name. Otherwise ""
- **recruiterEmail**: If any email address is mentioned in the post text (e.g. "send resume to xyz@company.com"), extract it. Otherwise ""
- **recruiterUrl**: If a recruiter/hiring manager profile URL is mentioned (different from poster), extract it. Otherwise use posterUrl if the poster is the hiring contact.
- **posterName**: The person who posted
- **posterHeadline**: Their professional title
- **posterUrl**: Use the provided profileUrl
- **postContent**: The actual post text (not UI chrome)
- **postUrl**: If any link points to a feed/activity URL, use it. Otherwise ""

Then score each job against the candidate profile:
- **fitScore** (0.0-1.0): Overall match. Consider skill/domain overlap, seniority match, work mode, AND location eligibility.
- **stackMatch** (0.0-1.0): Fraction of the job's required skills/domain knowledge the candidate has
- **seniorityMatch**: "exact" (matches target roles), "close" (one level off), "mismatch"
- **urgency**: "high" (urgently hiring, immediate start, few applicants), "medium" (standard), "low" (vague or future)
- **reasoning**: One sentence explaining the score. Mention location eligibility.
- **draftMessage**: Personalized 3-4 sentence DM to the poster expressing interest. Reference their post, mention relevant experience briefly, professional tone.
${domainInstructions(profile)}

LOCATION FILTER — CRITICAL:
The candidate is based in India. ONLY include jobs that are:
- Located in India (any Indian city)
- Remote with eligibility for India-based candidates (global remote, APAC remote, India remote)
- Remote with no specific country restriction mentioned
SKIP jobs that are:
- Onsite/hybrid in US, EU, UK, or other non-India locations
- Remote but explicitly restricted to US-only, EU-only, specific non-India timezone requirements
- If location is ambiguous, include it but note in reasoning

OTHER FILTERS — Also skip:
- Posts NOT about hiring (industry commentary, articles, etc.)
- Roles requiring skills/domain knowledge the candidate has zero experience with
- Roles clearly below seniority (junior, entry-level, intern, fresher)
- Recruiting agency posts without naming the actual company

Return ONLY a valid JSON array. No markdown, no code blocks.
If no relevant jobs found, return: []`;
}

function buildJobListingPrompt(profile: any): string {
  return `You are parsing structured text blocks extracted from LinkedIn Jobs search results. Each block is a job listing card.

Each block has:
- jobUrl: the LinkedIn job listing URL
- cardText: the raw visible text of the job card (title, company, location, metadata)
- links: any links found in the card

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

From each block, extract:
- **title**: The exact job title
- **company**: The company name
- **location**: Extract ANY city, state, country, or region from the card text. Use "Not specified" ONLY if no location text exists.
- **workMode**: ONLY set to "remote" if the card explicitly says "Remote". If a physical location is shown without explicit remote language, use "onsite". If both location AND remote/hybrid are mentioned, use "hybrid". Use "unknown" only if no clues exist.
- **salaryRange**: If shown, extract it. Otherwise null
- **jobUrl**: Use the provided jobUrl
- **applyUrl**: If any link points to an external careers/application page, extract it. Otherwise ""
- **jobDescription**: Whatever description snippet is visible
- **recruiterName**: If the card shows a recruiter or hiring manager name, extract it. Otherwise ""
- **recruiterEmail**: If any email is visible, extract it. Otherwise ""
- **recruiterUrl**: If a recruiter profile link is visible, extract it. Otherwise ""
- **posterName**: ""
- **posterHeadline**: ""
- **posterUrl**: ""
- **postContent**: ""
- **postUrl**: ""

Score each job against the candidate profile:
- **fitScore** (0.0-1.0): Overall match considering title, visible skill clues, seniority, work mode, AND location eligibility
- **stackMatch** (0.0-1.0): Estimated skill/domain overlap from available info
- **seniorityMatch**: "exact", "close", or "mismatch"
- **urgency**: "high" (posted today/yesterday, "Actively recruiting"), "medium" (this week), "low" (older)
- **reasoning**: One sentence. Mention location eligibility.
- **draftMessage**: "" (no DM for job listings — user applies directly)
${domainInstructions(profile)}

LOCATION FILTER — CRITICAL:
The candidate is based in India. ONLY include jobs that are:
- Located in India (any Indian city)
- Remote with eligibility for India-based candidates
- Remote with no specific country restriction mentioned
SKIP jobs onsite/hybrid outside India or restricted to non-India regions.

Return ONLY a valid JSON array. No markdown, no code blocks.
If no relevant jobs found, return: []`;
}

function buildJobBoardPrompt(profile: any): string {
  const yoe = profile.years_of_experience || 4;
  return `You are parsing structured text blocks extracted from an Indian job board (Naukri.com or Hirist.tech). Each block is a job listing card.

Each block has:
- jobUrl: the job listing URL on the board
- cardText: the raw visible text of the job card (title, company, location, experience, skills)
- links: any links found in the card

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

From each block, extract:
- **title**: The exact job title
- **company**: The company name
- **location**: Extract city/cities mentioned. These are Indian job boards so all jobs are India-based.
- **workMode**: "remote" if explicitly marked remote/WFH, "hybrid" if marked hybrid, "onsite" otherwise.
- **salaryRange**: If shown (e.g. "15-25 LPA", "₹20L - ₹35L"), extract it. Otherwise null
- **jobUrl**: Use the provided jobUrl. Prefix with "https://www.naukri.com" or "https://www.hirist.tech" if it's a relative path.
- **applyUrl**: Use the jobUrl (these boards have direct apply)
- **jobDescription**: Whatever skills, experience, and description text is visible
- **recruiterName**: If a recruiter or company HR name is shown, extract it. Otherwise ""
- **recruiterEmail**: If an email is shown, extract it. Otherwise ""
- **recruiterUrl**: ""
- **posterName**: ""
- **posterHeadline**: ""
- **posterUrl**: ""
- **postContent**: ""
- **postUrl**: ""

Score each job against the candidate profile:
- **fitScore** (0.0-1.0): Overall match considering title, skill/domain overlap, seniority, experience range
- **stackMatch** (0.0-1.0): Fraction of listed skills the candidate knows
- **seniorityMatch**: "exact", "close", or "mismatch" based on experience range vs ${yoe} YOE
- **urgency**: "high" (posted today/yesterday, "few applicants"), "medium" (this week), "low" (older)
- **reasoning**: One sentence
- **draftMessage**: "" (direct apply on these boards)
${domainInstructions(profile)}

All jobs on these boards are India-based, so no location filtering needed. Skip only:
- Roles requiring skills/domain knowledge the candidate has zero experience with
- Roles below seniority (junior, entry-level, 0-3 years)
- Roles WAY above (VP, CTO, Director)

Return ONLY a valid JSON array. No markdown, no code blocks.
If no relevant jobs found, return: []`;
}

export async function extractAndScoreJobs(
  blocksJson: string,
  keyword: string,
  mode: "content" | "jobs" | "naukri" | "hirist" = "content",
  profileOverride?: any,
  options: ScoreOptions = {},
): Promise<ScoredJob[]> {
  const profile = profileOverride || defaultProfile;

  let blocks: any[];
  try {
    const parsed = JSON.parse(blocksJson);
    blocks = Array.isArray(parsed) ? parsed : parsed.blocks || [];
  } catch {
    console.error("Failed to parse blocks JSON");
    return [];
  }

  if (blocks.length === 0) {
    console.error("No blocks to process");
    return [];
  }

  console.error(`Processing ${blocks.length} job blocks (${mode} mode)...`);

  const truncatedBlocks = blocks.slice(0, 30);
  const basePrompt = mode === "naukri" || mode === "hirist"
    ? buildJobBoardPrompt(profile)
    : mode === "jobs"
      ? buildJobListingPrompt(profile)
      : buildHiringPostPrompt(profile);

  const prompt = options.enhanced ? `${basePrompt}\n\n${enhancedScoringBlock()}` : basePrompt;
  const resumeBlock = options.resumeText && options.resumeText.trim()
    ? `CANDIDATE RÉSUMÉ (source of truth — judge each requirement against these real lines, not just the profile summary):\n${options.resumeText.trim()}\n\n`
    : "";
  const userContent = `${prompt}\n\n${resumeBlock}Search keyword: "${keyword}"\n\nBlocks:\n${JSON.stringify(truncatedBlocks, null, 2)}`;

  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: userContent }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let jsonStr = content.text.trim();

  const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();

  const arrayStart = jsonStr.indexOf("[");
  const arrayEnd = jsonStr.lastIndexOf("]");
  if (arrayStart === -1 || arrayEnd === -1) {
    console.error("No JSON array in response:", jsonStr.slice(0, 200));
    return [];
  }

  const rawSlice = jsonStr.slice(arrayStart, arrayEnd + 1);
  let jobs: ScoredJob[];

  try {
    jobs = JSON.parse(rawSlice);
  } catch (parseErr) {
    console.error(`    JSON parse failed, attempting repair: ${(parseErr as Error).message}`);

    // Try basic repair
    try {
      jobs = JSON.parse(repairJson(rawSlice));
      console.error(`    JSON repair succeeded`);
    } catch {
      // Retry via Claude — send broken output back for fixing
      console.error(`    Repair failed, retrying Claude call...`);
      try {
        const retryResponse = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          messages: [
            { role: "user", content: userContent },
            { role: "assistant", content: content.text },
            {
              role: "user",
              content: "Your JSON response was malformed and could not be parsed. Return the SAME data as a valid JSON array. No markdown, no code blocks. Only output the JSON array.",
            },
          ],
        });
        const retryContent = retryResponse.content[0];
        if (retryContent.type !== "text") throw new Error("Unexpected retry response type");
        let retryStr = retryContent.text.trim();
        const retryCodeMatch = retryStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (retryCodeMatch) retryStr = retryCodeMatch[1].trim();
        const rStart = retryStr.indexOf("[");
        const rEnd = retryStr.lastIndexOf("]");
        if (rStart === -1 || rEnd === -1) throw new Error("No JSON array in retry response");
        jobs = JSON.parse(retryStr.slice(rStart, rEnd + 1));
        console.error(`    Retry succeeded`);
      } catch (retryErr) {
        console.error(`    Retry also failed: ${(retryErr as Error).message}`);
        return [];
      }
    }
  }

  const scored = jobs.map((job) => ({
    ...job,
    keywordMatch: keyword,
    domain: job.domain || "",
    domainMatch: typeof job.domainMatch === "number" ? job.domainMatch : 0,
  }));

  const finalized = options.enhanced ? scored.map(attachBreakdown) : scored;
  return finalized.filter((job) => job.fitScore >= 0.3);
}
