/**
 * rescore.ts — Bulk re-draft messages for existing leads.
 *
 * Reads all leads from Turso, sends them to Claude in batches
 * to generate updated draft messages with the new tone
 * (no "small team", focus on their problem, calendar CTA).
 *
 * Usage:
 *   npx tsx scripts/rescore.ts              # Re-draft all leads
 *   npx tsx scripts/rescore.ts --dry-run    # Preview without writing
 *   npx tsx scripts/rescore.ts --limit 10   # Test on small batch
 */

import { loadEnv } from "../src/lib/pipeline/env";
loadEnv();

import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../src/lib/db";

const BATCH_SIZE = 25;

const REDRAFT_PROMPT = `You are updating outreach draft messages for leads in a CRM. For each lead below, generate a new draft message based on their profile and context.

TONE GUIDELINES:
1. Open by referencing their specific context (post content, company, or role)
2. Briefly mention relevant expertise that addresses their likely need
3. Do NOT mention team size, studio structure, or say "we're a small team"
4. End every message with: "Would love to explore how I can help — here's my calendar if you'd like to chat: https://calendar.app.google/HpsVS7VEWWWz69Kw9"

TIER CONTEXT (for reference):
- Tier 1: Freelance/contract work — websites, landing pages, bug fixes, SEO
- Tier 2: Product builds — MVPs, web apps, mobile apps
- Tier 3: AI founder scale-up — moving off no-code, proper infra, fractional CTO
- Tier 4: Branding & Packaging — brand identity, logo design, packaging design

For each lead, return ONLY the new draft message as a string. Return a JSON array of objects with "id" and "draftMessage" fields.

Return ONLY valid JSON. No markdown, no code blocks.`;

interface LeadRow {
  id: string;
  name: string;
  headline: string | null;
  company: string | null;
  post_content: string | null;
  keyword_match: string | null;
  tier: number;
  relevance: number;
  urgency: string;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;

  const db = getDb();

  const limitClause = limit ? `LIMIT ${limit}` : "";
  const result = await db.execute(
    `SELECT id, name, headline, company, post_content, keyword_match, tier, relevance, urgency
     FROM leads
     ORDER BY found_at DESC ${limitClause}`
  );

  const leads = result.rows as unknown as LeadRow[];

  console.log(`\n=== Lead Message Re-draft ===`);
  console.log(`Total leads: ${leads.length}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log();

  if (leads.length === 0) {
    console.log("No leads to process.");
    return;
  }

  const client = new Anthropic();
  let totalUpdated = 0;
  const totalBatches = Math.ceil(leads.length / BATCH_SIZE);

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} leads)...`);

    const leadsForPrompt = batch.map((l) => ({
      id: l.id,
      name: l.name,
      headline: l.headline || "",
      company: l.company || "",
      postSnippet: l.post_content ? l.post_content.slice(0, 200) : "",
      tier: l.tier,
      keyword: l.keyword_match || "",
    }));

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `${REDRAFT_PROMPT}\n\nLeads:\n${JSON.stringify(leadsForPrompt, null, 2)}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        console.error("  Unexpected response type, skipping batch");
        continue;
      }

      let jsonStr = content.text.trim();
      const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeMatch) jsonStr = codeMatch[1].trim();

      const arrayStart = jsonStr.indexOf("[");
      const arrayEnd = jsonStr.lastIndexOf("]");
      if (arrayStart === -1 || arrayEnd === -1) {
        console.error("  No JSON array in response, skipping batch");
        continue;
      }

      const updates: { id: string; draftMessage: string }[] = JSON.parse(
        jsonStr.slice(arrayStart, arrayEnd + 1)
      );

      if (dryRun) {
        for (const u of updates.slice(0, 3)) {
          const lead = batch.find((l) => l.id === u.id);
          console.log(`  ${lead?.name}: "${u.draftMessage.slice(0, 80)}..."`);
        }
        if (updates.length > 3) console.log(`  ... and ${updates.length - 3} more`);
      } else {
        const now = new Date().toISOString();
        for (const u of updates) {
          if (!u.draftMessage) continue;
          await db.execute({
            sql: "UPDATE leads SET draft_message = ?, updated_at = ? WHERE id = ?",
            args: [u.draftMessage, now, u.id],
          });
        }
        totalUpdated += updates.length;
        console.log(`  Updated ${updates.length} leads`);
      }
    } catch (err) {
      console.error(`  Batch ${batchNum} failed: ${(err as Error).message}`);
    }

    // Brief delay between batches to avoid rate limits
    if (i + BATCH_SIZE < leads.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== Complete ===`);
  if (dryRun) {
    console.log(`Would have updated ${leads.length} leads.`);
  } else {
    console.log(`Updated ${totalUpdated} lead draft messages.`);
  }
}

main().catch((err) => {
  console.error("Rescore failed:", err);
  process.exit(1);
});
