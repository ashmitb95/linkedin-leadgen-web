"use client";

interface StatItem {
  label: string;
  value: number | string;
  colorClass?: string;
}

export default function StatsBar({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-surface border border-border rounded-lg p-4"
        >
          <div className="text-xs text-text-muted uppercase tracking-wide">
            {stat.label}
          </div>
          <div className={`text-[28px] font-bold mt-1 ${stat.colorClass || "text-text"}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
