"use client";

import { useState } from "react";
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

export default function LeadCard({ lead, onStatusChange }: { lead: Lead; onStatusChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy Draft");
  const [emailCopyLabel, setEmailCopyLabel] = useState("Copy Email");

  const tierLabel =
    lead.tier === 1 ? "T1 Freelance" : lead.tier === 2 ? "T2 Product" : lead.tier === 3 ? "T3 AI Scale" : "T4 Branding";
  const isSalesNav = lead.keyword_match && lead.keyword_match.startsWith("[SN]");
  const contentLabel = isSalesNav ? "Profile Context" : "Full Post";
  const postSnippet = lead.post_content
    ? lead.post_content.slice(0, 300) + (lead.post_content.length > 300 ? "..." : "")
    : isSalesNav ? "No profile context" : "No post content captured";
  const relevancePct = Math.round(lead.relevance * 100);
  const foundDate = lead.found_at ? new Date(lead.found_at).toLocaleDateString() : "";
  const staleness = getStaleness(lead.post_date);

  async function updateStatus(status: string) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onStatusChange();
  }

  function copyDraft() {
    if (lead.draft_message) {
      navigator.clipboard.writeText(lead.draft_message).then(() => {
        setCopyLabel("Copied!");
        setTimeout(() => setCopyLabel("Copy Draft"), 1500);
      });
    }
  }

  function copyEmail() {
    if (lead.contact_email) {
      navigator.clipboard.writeText(lead.contact_email).then(() => {
        setEmailCopyLabel("Copied!");
        setTimeout(() => setEmailCopyLabel("Copy Email"), 1500);
      });
    }
  }

  return (
    <div className="card" style={{ cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      {/* Header row */}
      <div className="card-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fafafa", lineHeight: 1.4 }}>{lead.name}</div>
          <div style={{ fontSize: 13, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lead.company || "Unknown company"}
          </div>
        </div>
        <div className="card-badges">
          <Badge type="tier" value={tierLabel} />
          <Badge type="urgency" value={lead.urgency} />
          <Badge type="staleness" value={staleness.label} variant={staleness.type} />
          <select
            className="status-select"
            value={lead.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateStatus(e.target.value)}
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Headline */}
      {lead.headline && (
        <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 6 }}>{lead.headline}</div>
      )}

      {/* Post snippet */}
      <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        &ldquo;{postSnippet}&rdquo;
      </div>

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

      {/* Expanded */}
      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #27272a" }}>
          {lead.post_content && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">{contentLabel}</div>
              <div style={{ fontSize: 13, color: "#fafafa", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{lead.post_content}</div>
            </div>
          )}

          {(lead.contact_email || lead.contact_info) && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">Contact Info</div>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                {lead.contact_email && (
                  <div>
                    <span style={{ fontSize: 12, color: "#71717a", marginRight: 8 }}>Email:</span>
                    <a href={`mailto:${lead.contact_email}`} style={{ color: "#818cf8" }} onClick={(e) => e.stopPropagation()}>
                      {lead.contact_email}
                    </a>
                  </div>
                )}
                {lead.contact_info && (
                  <div>
                    <span style={{ fontSize: 12, color: "#71717a", marginRight: 8 }}>Other:</span>
                    <span style={{ color: "#fafafa" }}>{lead.contact_info}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {lead.draft_message && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">Draft Message</div>
              <pre className="code-block">{lead.draft_message}</pre>
            </div>
          )}

          <div className="card-actions">
            {lead.draft_message && (
              <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); copyDraft(); }}>
                {copyLabel}
              </button>
            )}
            {lead.contact_email && (
              <button className="btn" onClick={(e) => { e.stopPropagation(); copyEmail(); }}>
                {emailCopyLabel}
              </button>
            )}
            {lead.profile_url && (
              <a href={lead.profile_url} target="_blank" rel="noopener" className="btn" onClick={(e) => e.stopPropagation()}>
                Open LinkedIn
              </a>
            )}
            {lead.post_url && (
              <a href={lead.post_url} target="_blank" rel="noopener" className="btn" onClick={(e) => e.stopPropagation()}>
                View Post
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
