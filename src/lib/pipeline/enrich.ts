/**
 * enrich.ts — LinkedIn Voyager API contact enrichment.
 *
 * Extracts session cookies from the browser context, then calls
 * LinkedIn's internal Voyager API to fetch contact info.
 */

import type { BrowserContext } from "playwright";
import { hashProfileUrl, updateLeadContactInfo } from "./db-ops";

export async function getLinkedInCookies(context: BrowserContext) {
  const cookies = await context.cookies();
  const liAtCookie = cookies.find((c) => c.name === "li_at");
  const jsessionCookie = cookies.find((c) => c.name === "JSESSIONID");

  if (!liAtCookie || !jsessionCookie) {
    throw new Error(
      "Missing LinkedIn session cookies (li_at / JSESSIONID). Is the browser logged in?"
    );
  }

  const cookieHeader = cookies
    .filter((c) => c.domain?.includes("linkedin.com"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const csrfToken = jsessionCookie.value.replace(/"/g, "");

  return { cookieHeader, csrfToken };
}

export async function fetchContactInfo(
  publicId: string,
  cookieHeader: string,
  csrfToken: string
): Promise<{ email: string; contactInfo: string } | null> {
  const response = await fetch(
    `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/profileContactInfo`,
    {
      headers: {
        Cookie: cookieHeader,
        "csrf-token": csrfToken,
        "x-restli-protocol-version": "2.0.0",
        "x-li-lang": "en_US",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limited");
    return null;
  }

  const data = (await response.json()) as any;
  const email = data.emailAddress || "";
  const parts: string[] = [];
  if (data.phoneNumbers?.length)
    parts.push(`Phone: ${data.phoneNumbers[0].number}`);
  if (data.websites?.length)
    parts.push(`Web: ${data.websites.map((w: any) => w.url).join(", ")}`);
  if (data.twitterHandles?.length)
    parts.push(`Twitter: @${data.twitterHandles[0].name}`);

  if (!email && parts.length === 0) return null;

  return { email, contactInfo: parts.join("; ") };
}

function extractPublicId(profileUrl: string): string | null {
  const match = profileUrl.match(/\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}

export async function enrichLeadsWithVoyager(
  context: BrowserContext,
  leads: { profileUrl: string }[]
): Promise<number> {
  if (leads.length === 0) return 0;

  let cookieHeader: string;
  let csrfToken: string;

  try {
    ({ cookieHeader, csrfToken } = await getLinkedInCookies(context));
  } catch {
    console.log("    Voyager: Missing session cookies, skipping enrichment");
    return 0;
  }

  let enriched = 0;

  for (const lead of leads) {
    const publicId = extractPublicId(lead.profileUrl);
    if (!publicId) continue;

    try {
      const contact = await fetchContactInfo(publicId, cookieHeader, csrfToken);

      if (contact) {
        const id = hashProfileUrl(lead.profileUrl);
        await updateLeadContactInfo(id, contact.email, contact.contactInfo);
        enriched++;
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "Rate limited") {
        console.log(
          "    Voyager: Rate limited. Waiting 30s before continuing..."
        );
        await new Promise((r) => setTimeout(r, 30000));
      }
    }
  }

  if (enriched > 0)
    console.log(
      `    Voyager: enriched ${enriched}/${leads.length} leads with contact info`
    );
  return enriched;
}
