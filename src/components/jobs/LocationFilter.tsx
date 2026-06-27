"use client";

export interface LocationOption {
  value: string;
  count: number;
}

interface LocationFilterProps {
  options: LocationOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}

export default function LocationFilter({ options, selected, onToggle, onClear }: LocationFilterProps) {
  if (options.length < 2) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "4px 0 12px" }}>
      <span className="filter-label" style={{ marginRight: 4 }}>Location</span>
      {options.map((opt) => {
        const active = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className="pill"
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid",
              transition: "all 0.12s",
              ...(active
                ? { color: "#fafafa", borderColor: "#818cf8", background: "#818cf833" }
                : { color: "#a1a1aa", borderColor: "#3f3f46", background: "transparent" }),
            }}
          >
            {opt.value} <span style={{ opacity: 0.6, fontWeight: 400 }}>{opt.count}</span>
          </button>
        );
      })}
      {selected.size > 0 && (
        <button className="pill filter-clear" onClick={onClear} style={{ cursor: "pointer" }}>
          Clear
        </button>
      )}
    </div>
  );
}
