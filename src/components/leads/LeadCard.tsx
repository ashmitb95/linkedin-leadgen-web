"use client";

import type { Lead } from "@/lib/schema";
import Badge from "@/components/Badge";

function getStaleness(postDate: string | null): { label: string; type: string } {
  if (!postDate) return { label: "N/A", type: "staleness-na" };
  const d = new Date(postDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 7) return { label: days + "d ago", type: "staleness-fresh" };
  if (days <= 30) return { label: Math.floor(days / 7) + "w ago", type: "staleness-recent" };
  return { label: Math.floor(days / 30) + "mo ago", type: "staleness-stale" };
}

export default function LeadCard({
  lead,
  onSelect,
  onStatusChange,
}: {
  lead: Lead;
  onSelect: (lead: Lead) => void;
  onStatusChange: () => void;
}) {
  const tierLabel =
    lead.tier === 1 ? "T1 Freelance" : lead.tier === 2 ? "T2 Product" : lead.tier === 3 ? "T3 AI Scale" : "T4 Branding";
  const isSalesNav = !!(lead.keyword_match && lead.keyword_match.startsWith("[SN]"));
  const postSnippet = lead.post_content
    ? lead.post_content.slice(0, 300) + (lead.post_content.length > 300 ? "..." : "")
    : null;
  const relevancePct = Math.round(lead.relevance * 100);
  const foundDate = lead.found_at ? new Date(lead.found_at).toLocaleDateString("en-IN") : "";
  const staleness = getStaleness(lead.post_date);

  async function updateStatus(status: string) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onStatusChange();
  }

  return (
    <div className="card" style={{ cursor: "pointer" }} onClick={() => onSelect(lead)}>
      {/* Header row */}
      <div className="card-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fafafa", lineHeight: 1.4 }}>{lead.name}</div>
          <div style={{ fontSize: 13, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lead.company || "Unknown company"}
          </div>
        </div>
        <div className="card-badges">
          <Badge type="source" value={isSalesNav ? "Sales Navigator" : "Content"} />
          <Badge type="tier" value={tierLabel} />
          <Badge type="urgency" value={lead.urgency} />
          <Badge type="staleness" value={staleness.label} variant={staleness.type} />
          <select
            className="status-select"
            value={lead.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateStatus(e.target.value)}
          >
            <option value="new">Needs Triage</option>
            <option value="message_sent">Message Sent</option>
            <option value="reply_received">Reply Received</option>
            <option value="meeting_booked">Meeting Booked</option>
            <option value="client_converted">Converted</option>
            <option value="client_churned">Churned</option>
            <option value="invalid">Invalid</option>
          </select>
        </div>
      </div>

      {/* Headline */}
      {lead.headline && (
        <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 6 }}>{lead.headline}</div>
      )}

      {/* Post snippet */}
      {postSnippet ? (
        <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          &ldquo;{postSnippet}&rdquo;
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#52525b", marginBottom: 12, fontStyle: "italic" }}>
          {isSalesNav ? "Sourced from Sales Navigator — no post content" : "No post content captured"}
        </div>
      )}

      {/* Meta row */}
      <div className="card-meta">
        <span>
          Relevance: {relevancePct}%
          <span className="fit-bar">
            <span
              className={`fit-bar-fill ${relevancePct >= 70 ? "high" : relevancePct >= 40 ? "medium" : "low"}`}
              style={{ width: `${relevancePct}%` }}
            />
          </span>
        </span>
        <span>Found: {foundDate}</span>
        {lead.post_date && <span>Posted: {lead.post_date}</span>}
        {lead.keyword_match && (
          <span>Keyword: {lead.keyword_match.slice(0, 40)}...</span>
        )}
      </div>
    </div>
  );
}
