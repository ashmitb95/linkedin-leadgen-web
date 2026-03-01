"use client";

export interface StatItem {
  label: string;
  value: number | string;
  colorClass?: string;
  filterValue?: string;
}

const colorMap: Record<string, string> = {
  "text-green": "#22c55e",
  "text-blue": "#3b82f6",
  "text-yellow": "#eab308",
  "text-orange": "#f97316",
  "text-purple": "#a78bfa",
  "text-red": "#ef4444",
};

export default function StatsBar({ stats, activeFilter, onStatClick }: { stats: StatItem[]; activeFilter?: string; onStatClick?: (filterValue: string) => void }) {
  return (
    <div className="stats-grid">
      {stats.map((stat) => {
        const clickable = onStatClick && stat.filterValue !== undefined;
        const isActive = activeFilter !== undefined && stat.filterValue === activeFilter;
        return (
          <div
            key={stat.label}
            className={`stat-card${isActive ? " stat-card-active" : ""}`}
            style={clickable ? { cursor: "pointer" } : undefined}
            onClick={clickable ? () => onStatClick(stat.filterValue!) : undefined}
          >
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a1a1aa" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: (stat.colorClass && colorMap[stat.colorClass]) || "#fafafa" }}>
              {stat.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
