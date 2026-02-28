const badgeStyles: Record<string, string> = {
  // Tiers
  "tier-T1 Freelance": "bg-[#1e3a5f] text-[#60a5fa]",
  "tier-T2 Product": "bg-[#3b1f63] text-[#a78bfa]",
  "tier-T3 AI Scale": "bg-[#1f3d1f] text-[#4ade80]",
  "tier-T4 Branding": "bg-[#4a1942] text-[#f472b6]",
  // Urgency
  "urgency-high": "bg-[#3f1515] text-[#f87171]",
  "urgency-medium": "bg-[#3d2f0a] text-[#fbbf24]",
  "urgency-low": "bg-[#1a2332] text-[#94a3b8]",
  // Staleness
  "staleness-fresh": "bg-[#14532d] text-[#4ade80]",
  "staleness-recent": "bg-[#3d2f0a] text-[#fbbf24]",
  "staleness-stale": "bg-[#3f1515] text-[#f87171]",
  "staleness-na": "bg-[#1f2937] text-[#6b7280]",
  // Work mode
  "mode-remote": "bg-[#0f3d1f] text-[#4ade80]",
  "mode-hybrid": "bg-[#1e3a5f] text-[#60a5fa]",
  "mode-onsite": "bg-[#3d2510] text-[#fb923c]",
  "mode-unknown": "bg-[#1a2332] text-[#94a3b8]",
  // Seniority
  "seniority-exact": "bg-[#0f3d1f] text-[#4ade80]",
  "seniority-close": "bg-[#3d2f0a] text-[#fbbf24]",
  "seniority-mismatch": "bg-[#3f1515] text-[#f87171]",
  // Source
  "source-content": "bg-[#2d1b4e] text-[#c084fc]",
  "source-linkedin_content": "bg-[#2d1b4e] text-[#c084fc]",
  "source-jobs": "bg-[#1e3a5f] text-[#60a5fa]",
  "source-linkedin_jobs": "bg-[#1e3a5f] text-[#60a5fa]",
  "source-naukri": "bg-[#1f3d1f] text-[#4ade80]",
  "source-hirist": "bg-[#3d2f0a] text-[#fbbf24]",
};

export default function Badge({ type, value, variant }: { type: string; value: string; variant?: string }) {
  const key = variant || `${type}-${value}`;
  const style = badgeStyles[key] || "bg-[#1a2332] text-[#94a3b8]";

  return (
    <span
      className={`px-2 py-0.5 rounded-xl text-[11px] font-semibold uppercase tracking-wide ${style}`}
    >
      {value}
    </span>
  );
}
