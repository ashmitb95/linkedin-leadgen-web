const badgeColors: Record<string, { bg: string; fg: string }> = {
  "tier-T1 Freelance": { bg: "#1e3a5f", fg: "#60a5fa" },
  "tier-T2 Product": { bg: "#312e81", fg: "#a78bfa" },
  "tier-T3 AI Scale": { bg: "#14532d", fg: "#4ade80" },
  "tier-T4 Branding": { bg: "#4a1942", fg: "#f472b6" },
  "urgency-high": { bg: "#450a0a", fg: "#f87171" },
  "urgency-medium": { bg: "#422006", fg: "#fbbf24" },
  "urgency-low": { bg: "#27272a", fg: "#a1a1aa" },
  "staleness-fresh": { bg: "#14532d", fg: "#4ade80" },
  "staleness-recent": { bg: "#422006", fg: "#fbbf24" },
  "staleness-stale": { bg: "#450a0a", fg: "#f87171" },
  "staleness-na": { bg: "#27272a", fg: "#71717a" },
  "mode-remote": { bg: "#14532d", fg: "#4ade80" },
  "mode-hybrid": { bg: "#1e3a5f", fg: "#60a5fa" },
  "mode-onsite": { bg: "#431407", fg: "#fb923c" },
  "mode-unknown": { bg: "#27272a", fg: "#a1a1aa" },
  "seniority-exact": { bg: "#14532d", fg: "#4ade80" },
  "seniority-close": { bg: "#422006", fg: "#fbbf24" },
  "seniority-mismatch": { bg: "#450a0a", fg: "#f87171" },
  "source-content": { bg: "#2e1065", fg: "#c084fc" },
  "source-linkedin_content": { bg: "#2e1065", fg: "#c084fc" },
  "source-jobs": { bg: "#1e3a5f", fg: "#60a5fa" },
  "source-linkedin_jobs": { bg: "#1e3a5f", fg: "#60a5fa" },
  "source-naukri": { bg: "#14532d", fg: "#4ade80" },
  "source-hirist": { bg: "#422006", fg: "#fbbf24" },
  "source-salesnav": { bg: "#1e3a5f", fg: "#60a5fa" },
  "source-Sales Navigator": { bg: "#1e3a5f", fg: "#60a5fa" },
  "source-Content": { bg: "#2e1065", fg: "#c084fc" },
  "type-Tech": { bg: "#312e81", fg: "#a78bfa" },
  "type-Branding": { bg: "#4a1942", fg: "#f472b6" },
};

const defaultBadge = { bg: "#27272a", fg: "#a1a1aa" };

export default function Badge({ type, value, variant }: { type: string; value: string; variant?: string }) {
  const key = variant || `${type}-${value}`;
  const colors = badgeColors[key] || defaultBadge;

  return (
    <span
      className="badge"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {value}
    </span>
  );
}
