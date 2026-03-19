"use client";

import { useState } from "react";
import type { Job } from "@/lib/schema";
import Badge from "@/components/Badge";

function absUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/jobs/") || url.startsWith("/in/") || url.startsWith("/feed/"))
    return "https://www.linkedin.com" + url;
  if (url.startsWith("/job-listings-"))
    return "https://www.naukri.com" + url;
  if (url.startsWith("/j/") || url.startsWith("/s/"))
    return "https://www.hirist.tech" + url;
  if (url.startsWith("/"))
    return "https://www.linkedin.com" + url;
  return url;
}

interface JobCardProps {
  job: Job;
  apiPrefix: string;
  onStatusChange: () => void;
}

export default function JobCard({ job, apiPrefix, onStatusChange }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy Draft");
  const [notesLabel, setNotesLabel] = useState("Save Notes");
  const [notes, setNotes] = useState(job.notes || "");
  const [status, setStatus] = useState(job.status);

  const fitPct = Math.round(job.fit_score * 100);
  const stackPct = Math.round(job.stack_match * 100);
  const fitClass = fitPct >= 70 ? "high" : fitPct >= 40 ? "medium" : "low";
  const descSnippet = job.job_description
    ? job.job_description.slice(0, 160) + (job.job_description.length > 160 ? "..." : "")
    : "";
  const foundDate = job.found_at ? new Date(job.found_at).toLocaleDateString("en-IN") : "";

  async function updateStatus(newStatus: string) {
    const prevStatus = status;
    setStatus(newStatus);
    try {
      const res = await fetch(`${apiPrefix}/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) setStatus(prevStatus);
    } catch {
      setStatus(prevStatus);
    }
    onStatusChange();
  }

  async function saveNotes() {
    await fetch(`${apiPrefix}/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setNotesLabel("Saved!");
    setTimeout(() => setNotesLabel("Save Notes"), 1500);
  }

  function copyDraft() {
    if (job.draft_message) {
      navigator.clipboard.writeText(job.draft_message).then(() => {
        setCopyLabel("Copied!");
        setTimeout(() => setCopyLabel("Copy Draft"), 1500);
      });
    }
  }

  return (
    <div className="card" style={{ cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      {/* Header */}
      <div className="card-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fafafa", lineHeight: 1.4 }}>{job.title}</div>
          <div style={{ fontSize: 13, color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.company || "Unknown company"}
          </div>
        </div>
        <div className="card-badges">
          <Badge type="mode" value={job.work_mode} />
          <Badge type="seniority" value={job.seniority_match} />
          <Badge type="source" value={job.source} />
          <select
            className="status-select"
            value={status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateStatus(e.target.value)}
          >
            {["new", "saved", "applied", "interviewing", "offer", "rejected", "archived"].map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {job.location && <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 4 }}>{job.location}</div>}
      {job.salary_range && <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>{job.salary_range}</div>}
      {descSnippet && (
        <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {descSnippet}
        </div>
      )}

      {/* Meta */}
      <div className="card-meta">
        <span style={{ fontWeight: 600 }}>
          Fit: {fitPct}%
          <span className="fit-bar">
            <span className={`fit-bar-fill ${fitClass}`} style={{ width: `${fitPct}%` }} />
          </span>
        </span>
        <span>Stack: {stackPct}%</span>
        <Badge type="urgency" value={job.urgency} />
        <span>Found: {foundDate}</span>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #27272a" }} onClick={(e) => e.stopPropagation()}>
          {job.reasoning && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">Reasoning</div>
              <div style={{ fontSize: 13, color: "#fafafa", lineHeight: 1.6 }}>{job.reasoning}</div>
            </div>
          )}

          {job.job_description && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">Full Description</div>
              <div style={{ fontSize: 13, color: "#fafafa", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{job.job_description}</div>
            </div>
          )}

          {job.post_content && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">Original Post{job.poster_name ? ` by ${job.poster_name}` : ""}</div>
              <pre className="code-block">{job.post_content}</pre>
            </div>
          )}

          {job.draft_message && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">Draft Message</div>
              <pre className="code-block">{job.draft_message}</pre>
            </div>
          )}

          {(job.recruiter_name || job.recruiter_email || job.recruiter_url) && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">Recruiter / Contact</div>
              <div style={{ fontSize: 13, color: "#fafafa" }}>
                {job.recruiter_name && <strong>{job.recruiter_name}</strong>}
                {job.recruiter_email && (
                  <> &mdash; <a href={`mailto:${job.recruiter_email}`} style={{ color: "#818cf8" }}>{job.recruiter_email}</a></>
                )}
                {job.recruiter_url && (
                  <> &mdash; <a href={absUrl(job.recruiter_url)} target="_blank" rel="noopener" style={{ color: "#818cf8" }}>Profile</a></>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <div className="section-label">Notes</div>
            <textarea
              className="notes-area"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
            />
            <button className="btn" style={{ marginTop: 8, padding: "6px 16px", fontSize: 12 }} onClick={saveNotes}>
              {notesLabel}
            </button>
          </div>

          {/* Actions */}
          <div className="card-actions">
            {job.apply_url && <a href={absUrl(job.apply_url)} target="_blank" rel="noopener" className="btn btn-primary">Apply Now</a>}
            {job.draft_message && <button className="btn btn-primary" onClick={copyDraft}>{copyLabel}</button>}
            {job.job_url && <a href={absUrl(job.job_url)} target="_blank" rel="noopener" className="btn">Open Job</a>}
            {job.post_url && <a href={absUrl(job.post_url)} target="_blank" rel="noopener" className="btn">View Post</a>}
            {job.poster_url && <a href={absUrl(job.poster_url)} target="_blank" rel="noopener" className="btn">Poster Profile</a>}
            {job.recruiter_url && job.recruiter_url !== job.poster_url && (
              <a href={absUrl(job.recruiter_url)} target="_blank" rel="noopener" className="btn">Recruiter</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
