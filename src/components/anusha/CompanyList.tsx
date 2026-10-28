"use client";

import type { CompanySummary } from "@/lib/anusha-companies-shared";
import { CompanyLogo } from "./bits";

const GROUPS: { tier: number; label: string }[] = [
  { tier: 1, label: "Top picks · Global pharma & biotech" },
  { tier: 2, label: "Indian pharma, vaccines & CDMOs" },
  { tier: 3, label: "Consulting & research firms" },
];

const DOT_CLASS: Record<CompanySummary["progress"], string> = {
  none: "ac-dot",
  started: "ac-dot ac-started",
  replied: "ac-dot ac-replied",
};

interface Props {
  companies: CompanySummary[];
  selected: string | null;
  onSelect: (slug: string) => void;
}

export default function CompanyList({ companies, selected, onSelect }: Props) {
  return (
    <div className="ac-list">
      {GROUPS.map(({ tier, label }) => {
        const inGroup = companies.filter((c) => c.tier === tier);
        if (!inGroup.length) return null;
        return (
          <div key={tier} style={{ display: "contents" }}>
            <div className="ac-group">{label}</div>
            {inGroup.map((c) => {
              const bits = [c.cities.join(" · ")];
              if (c.relevantJobs) bits.push(`${c.relevantJobs} job${c.relevantJobs === 1 ? "" : "s"}`);
              return (
                <button
                  key={c.slug}
                  className={c.slug === selected ? "ac-item ac-on" : "ac-item"}
                  onClick={() => onSelect(c.slug)}
                >
                  <CompanyLogo name={c.name} website={c.website} />
                  <div className="ac-item-text">
                    <b>{c.name}</b>
                    <span>{bits.join(" · ")}</span>
                  </div>
                  {c.alumni > 0 && <span className="ac-tag ac-tag-alum" title="Ex-Bharat Biotech colleagues here">🎓 {c.alumni}</span>}
                  <div className={DOT_CLASS[c.progress]} />
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="ac-legend">
        <span><i className="ac-dot" /> Not started</span>
        <span><i className="ac-dot ac-started" /> Reached out</span>
        <span><i className="ac-dot ac-replied" /> Got a reply</span>
      </div>
    </div>
  );
}
