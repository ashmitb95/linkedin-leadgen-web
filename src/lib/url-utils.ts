/**
 * url-utils.ts — Shared URL helpers for LinkedIn URLs.
 */

export function absUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `https://www.linkedin.com${url}`;
  return url;
}

export function extractPublicProfileUrl(
  profileUrl: string,
  links?: { text: string; href: string }[]
): string {
  // If the profileUrl is already a public /in/ URL, use it
  if (profileUrl.includes("/in/")) return absUrl(profileUrl);

  // For Sales Nav URLs, look for /in/ link in the card links
  if (links) {
    for (const link of links) {
      if (link.href.includes("/in/")) {
        return absUrl(link.href.split("?")[0]);
      }
    }
  }

  return "";
}
