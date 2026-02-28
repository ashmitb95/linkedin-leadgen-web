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
    <div className="flex gap-2 mb-5 flex-wrap">
      {groups.map((group) => (
        <div key={group.key} className="flex gap-1 items-center">
          <span className="text-xs text-text-muted mr-1">{group.label}:</span>
          {group.options.map((opt) => {
            const isActive = (current[group.key] || "") === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(group.key, opt.value)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] border cursor-pointer transition-all ${
                  isActive
                    ? "bg-accent border-accent text-white"
                    : "bg-surface border-border text-text-muted hover:text-text hover:border-accent"
                }`}
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
