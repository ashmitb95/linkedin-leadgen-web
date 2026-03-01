"use client";

interface StatItem {
  label: string;
  value: number | string;
  colorClass?: string;
}

const colorMap: Record<string, string> = {
  "text-green": "#22c55e",
  "text-blue": "#3b82f6",
  "text-yellow": "#eab308",
  "text-orange": "#f97316",
  "text-purple": "#a78bfa",
  "text-red": "#ef4444",
};

export default function StatsBar({ stats }: { stats: StatItem[] }) {
  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a1a1aa" }}>
            {stat.label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: (stat.colorClass && colorMap[stat.colorClass]) || "#fafafa" }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
