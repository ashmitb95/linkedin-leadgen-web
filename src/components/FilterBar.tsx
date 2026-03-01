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
  return (
    <div className="filter-bar no-scrollbar">
      {groups.map((group) => (
        <div key={group.key} className="filter-group">
          <span className="filter-label">
            {group.label}:
          </span>
          {group.options.map((opt) => {
            const isActive = (current[group.key] || "") === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(group.key, opt.value)}
                className={isActive ? "pill pill-active" : "pill"}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
