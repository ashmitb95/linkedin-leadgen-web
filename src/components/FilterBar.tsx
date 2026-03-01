"use client";

export interface FilterGroup {
  label: string;
  key: string;
  options: { label: string; value: string }[];
}

interface FilterBarProps {
  groups: FilterGroup[];
  current: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function FilterBar({ groups, current, onChange }: FilterBarProps) {
  const hasActiveFilters = groups.some(
    (g) => g.key !== "sort" && (current[g.key] || "") !== ""
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
        flex: 1,
        minWidth: 0,
      }}
    >
      {groups.map((group) => (
        <div key={group.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="filter-label">{group.label}</span>
          <select
            className="status-select"
            value={current[group.key] || ""}
            onChange={(e) => onChange(group.key, e.target.value)}
            style={{ minHeight: 34, padding: "6px 10px", fontSize: 13 }}
          >
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {hasActiveFilters && (
        <button
          className="pill"
          style={{ fontSize: 12, padding: "6px 12px" }}
          onClick={() => {
            for (const g of groups) {
              if (g.key !== "sort") onChange(g.key, "");
            }
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
