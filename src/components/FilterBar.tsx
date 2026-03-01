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
    <div className="filter-grid">
      {groups.map((group) => (
        <div key={group.key} className="filter-item">
          <span className="filter-label">{group.label}</span>
          <select
            className="status-select filter-select"
            value={current[group.key] || ""}
            onChange={(e) => onChange(group.key, e.target.value)}
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
          className="pill filter-clear"
          onClick={() => {
            for (const g of groups) {
              if (g.key !== "sort") onChange(g.key, "");
            }
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
