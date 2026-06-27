/**
 * location.ts — Canonicalize messy free-text job locations into a single
 * grouping label, so the dashboard can offer a clean multi-select.
 *
 * Strategy: normalize (strip country/state/mode noise) + an alias map for
 * official city renames that edit-distance can't catch (Bangalore↔Bengaluru,
 * Gurgaon↔Gurugram). Spelling variants only — distinct cities stay distinct.
 */

const REMOTE_RE = /\b(remote|work from home|wfh|anywhere|telecommute)\b/i;

// Words that are noise inside a city token.
const NOISE_RE =
  /\b(india|bharat|hybrid|onsite|on[\s-]?site|in[\s-]?office|wf[oh]|area|region|metropolitan|metro|district|division|greater|urban|rural)\b/gi;

// Same city, different spelling/old name → one canonical label.
const ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  gurgaon: "Gurugram",
  gurugram: "Gurugram",
  bombay: "Mumbai",
  mumbai: "Mumbai",
  calcutta: "Kolkata",
  kolkata: "Kolkata",
  madras: "Chennai",
  chennai: "Chennai",
  poona: "Pune",
  pune: "Pune",
  trivandrum: "Thiruvananthapuram",
  thiruvananthapuram: "Thiruvananthapuram",
  "new delhi": "Delhi",
  delhi: "Delhi",
  "delhi ncr": "Delhi",
  ncr: "Delhi",
  vizag: "Visakhapatnam",
  visakhapatnam: "Visakhapatnam",
  baroda: "Vadodara",
  vadodara: "Vadodara",
};

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export const REMOTE_LABEL = "Remote";
export const UNSPECIFIED_LABEL = "Not specified";

export function canonicalizeLocation(raw?: string | null): string {
  if (!raw) return UNSPECIFIED_LABEL;
  const text = raw.trim();
  if (!text) return UNSPECIFIED_LABEL;
  if (REMOTE_RE.test(text)) return REMOTE_LABEL;

  // First location token (handles "Bengaluru, Karnataka, India", "Pune / Mumbai").
  let token = (text.split(/[,/|;•]/)[0] || text)
    .replace(NOISE_RE, "")
    .replace(/[()]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!token || token === "na" || token === "n/a" || token === "not specified") {
    return UNSPECIFIED_LABEL;
  }
  return ALIASES[token] || titleCase(token);
}
