"use client";

import { useState } from "react";
import type { Lead } from "@/lib/schema";
import Badge from "@/components/Badge";
import { absUrl } from "@/lib/url-utils";

function getStaleness(postDate: string | null): { label: string; type: string } {
  if (!postDate) return { label: "N/A", type: "staleness-na" };
  const d = new Date(postDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 7) return { label: days + "d ago", type: "staleness-fresh" };
  if (days <= 30) return { label: Math.floor(days / 7) + "w ago", type: "staleness-recent" };
  return { label: Math.floor(days / 30) + "mo ago", type: "staleness-stale" };
}

export default function LeadDetail({
  lead,
  onStatusChange,
}: {
  lead: Lead;
  onStatusChange: () => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy Draft");
  const [emailCopyLabel, setEmailCopyLabel] = useState("Copy Email");

  const tierLabel =
    lead.tier === 1
      ? "T1 Freelance"
      : lead.tier === 2
        ? "T2 Product"
        : lead.tier === 3
          ? "T3 AI Scale"
          : "T4 Branding";
  const isSalesNav = lead.keyword_match?.startsWith("[SN]");
  const contentLabel = isSalesNav ? "Profile Context" : "Post Content";
  const relevancePct = Math.round(lead.relevance * 100);
  const staleness = getStaleness(lead.post_date);
  const foundDate = lead.found_at ? new Date(lead.found_at).toLocaleDateString() : "";

  // Determine which profile URL to show
  const publicUrl = lead.public_profile_url ? absUrl(lead.public_profile_url) : "";
  const profileUrl = absUrl(lead.profile_url);
  const displayUrl = publicUrl || profileUrl;
  const hasBothUrls = publicUrl && profileUrl && publicUrl !== profileUrl;

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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fafafa", marginBottom: 4 }}>
          {lead.name}
        </div>
        {lead.headline && (
          <div style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 4 }}>{lead.headline}</div>
        )}
        <div style={{ fontSize: 13, color: "#71717a" }}>
          {lead.company || "Unknown company"}
        </div>
      </div>

      {/* Profile link */}
      {displayUrl && (
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener"
          className="btn btn-primary"
          style={{ textAlign: "center", justifyContent: "center" }}
        >
          View Profile
        </a>
      )}

      {/* Badges */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Badge type="source" value={isSalesNav ? "Sales Navigator" : "Content"} />
        <Badge type="tier" value={tierLabel} />
        <Badge type="urgency" value={lead.urgency} />
        <Badge type="staleness" value={staleness.label} variant={staleness.type} />
      </div>

      {/* Status */}
      <div>
        <div className="section-label">Status</div>
        <select
          className="status-select"
          value={lead.status}
          onChange={(e) => updateStatus(e.target.value)}
          style={{ width: "100%" }}
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

      {/* Meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#71717a" }}>
          Relevance: {relevancePct}%
          <span className="fit-bar" style={{ marginLeft: 8 }}>
            <span
              className={`fit-bar-fill ${relevancePct >= 70 ? "high" : relevancePct >= 40 ? "medium" : "low"}`}
              style={{ width: `${relevancePct}%` }}
            />
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#71717a" }}>Found: {foundDate}</div>
        {lead.post_date && (
          <div style={{ fontSize: 12, color: "#71717a" }}>Posted: {lead.post_date}</div>
        )}
        {lead.keyword_match && (
          <div style={{ fontSize: 12, color: "#71717a" }}>
            Keyword: {lead.keyword_match}
          </div>
        )}
      </div>

      {/* Post Preview */}
      {lead.post_content && (
        <div>
          <div className="section-label">{contentLabel}</div>
          <div
            style={{
              background: "#09090b",
              border: "1px solid #27272a",
              borderRadius: 12,
              padding: 16,
              fontSize: 13,
              color: "#fafafa",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {lead.post_content}
          </div>
        </div>
      )}

      {/* Contact Info */}
      {(lead.contact_email || lead.contact_info) && (
        <div>
          <div className="section-label">Contact Info</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lead.contact_email && (
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "#71717a", marginRight: 8 }}>Email:</span>
                <a href={`mailto:${lead.contact_email}`} style={{ color: "#818cf8" }}>
                  {lead.contact_email}
                </a>
              </div>
            )}
            {lead.contact_info && (
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "#71717a", marginRight: 8 }}>Other:</span>
                <span style={{ color: "#fafafa" }}>{lead.contact_info}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draft Message */}
      {lead.draft_message && (
        <div>
          <div className="section-label">Draft Message</div>
          <pre className="code-block">{lead.draft_message}</pre>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lead.draft_message && (
          <button className="btn" onClick={copyDraft} style={{ justifyContent: "center" }}>
            {copyLabel}
          </button>
        )}
        {lead.contact_email && (
          <button className="btn" onClick={copyEmail} style={{ justifyContent: "center" }}>
            {emailCopyLabel}
          </button>
        )}
        {lead.post_url && (
          <a
            href={lead.post_url}
            target="_blank"
            rel="noopener"
            className="btn"
            style={{ justifyContent: "center", textAlign: "center" }}
          >
            View Post
          </a>
        )}
        {hasBothUrls && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener"
            className="btn"
            style={{ justifyContent: "center", textAlign: "center" }}
          >
            Sales Nav Profile
          </a>
        )}
      </div>
    </div>
  );
}
