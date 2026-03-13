/**
 * extract.ts — Lead scoring via Claude.
 *
 * Takes raw blocks extracted from LinkedIn by browser JS,
 * sends them to Claude for scoring and draft message generation.
 */

import Anthropic from "@anthropic-ai/sdk";
import { repairJson } from "./json-utils";

export interface ScoredLead {
  name: string;
  headline: string;
  company: string;
  profileUrl: string;
  publicProfileUrl: string;
  postContent: string;
  postUrl: string;
  keywordMatch: string;
  tier: number;
  relevance: number;
  urgency: "high" | "medium" | "low";
  draftMessage: string;
  reasoning: string;
  contactEmail: string;
  contactInfo: string;
  postDate: string;
}

const CONTENT_SEARCH_PROMPT = `You are parsing structured text blocks extracted from LinkedIn content search results. Each block represents one search result card containing a person's post.

Each block has:
- profileUrl: their LinkedIn profile URL
- cardText: the raw visible text of their result card
- links: any links found in the card

From each block, extract:
- **name**: The person's full name (usually the first prominent text)
- **headline**: Their professional title/headline
- **company**: Extracted from headline (e.g., "VP Engineering at Acme" → "Acme")
- **profileUrl**: Use the provided profileUrl
- **publicProfileUrl**: If the profileUrl contains "/in/", use it as-is. If it's a Sales Nav URL (/sales/lead/...), check the links array for any URL containing "/in/" and use that. Otherwise "".
- **postContent**: The text of their actual post (not UI chrome)
- **postUrl**: If any link points to a feed/update URL, use it. Otherwise ""
- **contactEmail**: Any email address found in the post text (e.g., "reach me at john@example.com"). Return "" if none found.
- **contactInfo**: Any other contact information: phone numbers, website URLs, Twitter/X handles, "DM me at...", WhatsApp numbers, Calendly links, etc. Return "" if none found.
- **postDate**: Look for a relative timestamp in the card text (e.g., "2d", "1w", "3mo", "1h", "5d • Edited"). Convert to an ISO date (YYYY-MM-DD) using today's date provided below. Examples: "2d" → 2 days ago, "1w" → 7 days ago, "3mo" → 90 days ago, "1yr" → 365 days ago. Return "" if no date indicator found.

Then score each lead for a software engineering and design studio:

**Our services:**
- Tier 1: Freelance/contract — websites, landing pages, bug fixes, SEO. $500-$5K.
- Tier 2: Product builds — MVPs, web apps, mobile apps. $5K-$30K+.
- Tier 3: AI founder scale-up — moving off no-code, proper infra, fractional CTO. $10K-$50K+.
- Tier 4: Branding & Packaging — brand identity, logo design, packaging design, visual systems for CPG/DTC brands. $2K-$15K.

**Ideal clients:** Founders, small biz owners (1-50 employees), non-technical AI builders, CPG/DTC brand owners, food/beauty/wellness startup founders.
**NOT clients:** Large enterprises (500+), casual chat, recruiters, spam, ads.

**STALE POST DETECTION:**
Check the card text for indicators the need has been fulfilled or the post is outdated:
- Comment snippets: "position filled", "found someone", "no longer looking", "hired someone", "closed", "sorted this out", "all set now"
- Poster updates: "Edit:", "Update:" followed by closure language
If ANY stale indicators are found: set relevance to 0.1, urgency to "low", and prefix reasoning with "STALE: [indicator found]"

For each lead:
- **tier** (1, 2, 3, or 4)
- **relevance** (0.0-1.0) — 0.8+ strong, 0.5-0.8 maybe, below 0.3 skip
- **urgency** — "high" (actively looking for help), "medium" (discussing pain), "low" (tangential)
- **draftMessage** — Personalized 3-4 sentence DM:
  1. Open by referencing their specific post or problem
  2. Briefly mention relevant expertise that directly addresses their need (do NOT mention team size, studio structure, or say "we're a small team")
  3. End with: "Would love to explore how I can help — here's my calendar if you'd like to chat: https://calendar.app.google/HpsVS7VEWWWz69Kw9"
- **reasoning** — One sentence

Skip promoted/ad content and irrelevant posts.
Return ONLY a valid JSON array. No markdown, no code blocks.
If no relevant leads found, return: []`;

const SALES_NAV_PROMPT = `You are parsing structured text blocks extracted from LinkedIn Sales Navigator people search results. Each block is a lead profile card (NOT a post — these are profile summaries).

Each block has:
- profileUrl: their Sales Navigator or LinkedIn profile URL
- cardText: the raw visible text of their result card (name, headline, company, location, connections info)
- links: any links found in the card

From each block, extract:
- **name**: The person's full name
- **headline**: Their professional title/headline
- **company**: Their current company
- **profileUrl**: Use the provided profileUrl. If it's a /sales/lead/ URL, keep it as-is.
- **publicProfileUrl**: Check the links array for any URL containing "/in/". If found, use that URL (this is their public LinkedIn profile). If not found, return "".
- **postContent**: Include a concise summary of the profile context from the card text — headline, company, any recent activity snippets, mutual connections, or other contextual details visible in the card. This helps personalize outreach. Do NOT leave empty.
- **postUrl**: Set to ""
- **contactEmail**: Any email address visible in the card text. Return "" if none found.
- **contactInfo**: Any other contact info found: phone, website, Twitter/X handle. Return "" if none found.
- **postDate**: Set to "" (no post date for people search results).

Then score each lead for a software engineering and design studio:

**Our services:**
- Tier 1: Freelance/contract — websites, landing pages, bug fixes, SEO. $500-$5K.
- Tier 2: Product builds — MVPs, web apps, mobile apps. $5K-$30K+.
- Tier 3: AI founder scale-up — moving off no-code, proper infra, fractional CTO. $10K-$50K+.
- Tier 4: Branding & Packaging — brand identity, logo design, packaging design, visual systems for CPG/DTC brands. $2K-$15K.

**Ideal clients:** Founders, small biz owners (1-50 employees), non-technical AI builders, solo entrepreneurs, CPG/DTC brand owners, food/beauty/wellness startup founders.
**NOT clients:** Large enterprises (500+), recruiters, job seekers, students, engineers/developers (they ARE developers, not clients).

Score based on their PROFILE (headline, company, role) — not post content:
- **tier** (1, 2, 3, or 4) — infer from their role/company. CPG/DTC brand founders = Tier 4.
- **relevance** (0.0-1.0) — how well they match our ICP. Founders/owners of small companies = high. Developers/engineers = 0.0.
- **urgency** — "low" for all (profile match only, no active buying signal)
- **draftMessage** — Personalized 3-4 sentence cold DM:
  1. Reference their company/role/industry context
  2. Mention a specific way you could help based on what their company likely needs (do NOT mention team size, studio structure, or say "we're a small team")
  3. End with: "Would love to explore how I can help — here's my calendar if you'd like to chat: https://calendar.app.google/HpsVS7VEWWWz69Kw9"
- **reasoning** — One sentence

IMPORTANT: Be selective. Only include leads that are clearly potential CLIENTS (non-technical decision-makers who might need dev services). Filter out developers, engineers, recruiters, students, and people at large companies.
Return ONLY a valid JSON array. No markdown, no code blocks.
If no relevant leads found, return: []`;

export async function extractAndScore(
  blocksJson: string,
  keyword: string,
  mode: "content" | "sales_nav" = "content"
): Promise<ScoredLead[]> {
  let blocks: { profileUrl: string; cardText: string; links: { text: string; href: string }[] }[];

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

  console.error(`Processing ${blocks.length} result blocks (${mode} mode)...`);

  const truncatedBlocks = blocks.slice(0, 30);
  const prompt = mode === "sales_nav" ? SALES_NAV_PROMPT : CONTENT_SEARCH_PROMPT;
  const client = new Anthropic();
  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nToday's date: ${today}\nSearch keyword: "${keyword}"\n\nBlocks:\n${JSON.stringify(truncatedBlocks, null, 2)}`,
      },
    ],
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
  let leads: ScoredLead[];

  try {
    leads = JSON.parse(rawSlice);
  } catch (parseErr) {
    console.error(`    JSON parse failed, attempting repair: ${(parseErr as Error).message}`);

    // Try basic repair
    try {
      leads = JSON.parse(repairJson(rawSlice));
      console.error(`    JSON repair succeeded`);
    } catch {
      // Retry via Claude — send broken output back for fixing
      console.error(`    Repair failed, retrying Claude call...`);
      try {
        const retryResponse = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: `${prompt}\n\nToday's date: ${today}\nSearch keyword: "${keyword}"\n\nBlocks:\n${JSON.stringify(truncatedBlocks, null, 2)}`,
            },
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
        leads = JSON.parse(retryStr.slice(rStart, rEnd + 1));
        console.error(`    Retry succeeded`);
      } catch (retryErr) {
        console.error(`    Retry also failed: ${(retryErr as Error).message}`);
        return [];
      }
    }
  }

  return leads
    .map((lead) => ({
      ...lead,
      keywordMatch: keyword,
      publicProfileUrl: lead.publicProfileUrl || "",
      contactEmail: lead.contactEmail || "",
      contactInfo: lead.contactInfo || "",
      postDate: lead.postDate || "",
    }))
    .filter((lead) => lead.relevance >= 0.3);
}
