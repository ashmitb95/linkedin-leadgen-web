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

  const fitPct = Math.round(job.fit_score * 100);
  const stackPct = Math.round(job.stack_match * 100);
  const fitClass = fitPct >= 70 ? "high" : fitPct >= 40 ? "medium" : "low";
  const descSnippet = job.job_description
    ? job.job_description.slice(0, 160) + (job.job_description.length > 160 ? "..." : "")
    : "";
  const foundDate = job.found_at ? new Date(job.found_at).toLocaleDateString() : "";

  async function updateStatus(status: string) {
    await fetch(`${apiPrefix}/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
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
    <div
      className="bg-surface border border-border rounded-lg px-5 py-4 cursor-pointer transition-all hover:border-accent hover:bg-surface-hover"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-1.5">
        <div>
          <div className="text-[15px] font-semibold">{job.title}</div>
          <div className="text-[13px] text-text-muted">{job.company || "Unknown company"}</div>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          <Badge type="mode" value={job.work_mode} />
          <Badge type="seniority" value={job.seniority_match} />
          <Badge type="source" value={job.source} />
          <select
            className="status-select"
            value={job.status}
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

      {job.location && (
        <div className="text-xs text-text-muted mb-1.5">{job.location}</div>
      )}
      {job.salary_range && (
        <div className="text-[13px] text-green font-semibold mb-1.5">{job.salary_range}</div>
      )}
      {descSnippet && (
        <div className="text-[13px] text-text-muted mb-2 line-clamp-2">{descSnippet}</div>
      )}

      {/* Meta */}
      <div className="flex gap-4 text-xs text-text-muted items-center">
        <span className="font-semibold">
          Fit: {fitPct}%{" "}
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
        <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
          {job.reasoning && (
            <div className="mb-3">
              <h4 className="text-xs text-text-muted uppercase mb-1">Reasoning</h4>
              <p className="text-[13px] text-text">{job.reasoning}</p>
            </div>
          )}

          {job.job_description && (
            <div className="mb-3">
              <h4 className="text-xs text-text-muted uppercase mb-1">Full Description</h4>
              <p className="text-[13px] text-text whitespace-pre-wrap">{job.job_description}</p>
            </div>
          )}

          {job.post_content && (
            <div className="mb-3">
              <h4 className="text-xs text-text-muted uppercase mb-1">
                Original Post{job.poster_name ? ` by ${job.poster_name}` : ""}
              </h4>
              <pre className="text-[13px] text-text bg-bg p-3 rounded-md whitespace-pre-wrap break-words">
                {job.post_content}
              </pre>
            </div>
          )}

          {job.draft_message && (
            <div className="mb-3">
              <h4 className="text-xs text-text-muted uppercase mb-1">Draft Message</h4>
              <pre className="text-[13px] text-text bg-bg p-3 rounded-md whitespace-pre-wrap break-words">
                {job.draft_message}
              </pre>
            </div>
          )}

          {(job.recruiter_name || job.recruiter_email || job.recruiter_url) && (
            <div className="mb-3">
              <h4 className="text-xs text-text-muted uppercase mb-1">Recruiter / Contact</h4>
              <p className="text-[13px] text-text">
                {job.recruiter_name && <strong>{job.recruiter_name}</strong>}
                {job.recruiter_email && (
                  <> &mdash; <a href={`mailto:${job.recruiter_email}`} className="text-accent-light">{job.recruiter_email}</a></>
                )}
                {job.recruiter_url && (
                  <> &mdash; <a href={absUrl(job.recruiter_url)} target="_blank" rel="noopener" className="text-accent-light">Profile</a></>
                )}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="mb-3">
            <h4 className="text-xs text-text-muted uppercase mb-1">Notes</h4>
            <textarea
              className="notes-area"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
            />
            <button
              className="text-xs px-2.5 py-1 mt-1 bg-accent border-none text-white rounded cursor-pointer hover:bg-accent-light"
              onClick={saveNotes}
            >
              {notesLabel}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {job.apply_url && (
              <a
                href={absUrl(job.apply_url)}
                target="_blank"
                rel="noopener"
                className="px-3.5 py-1.5 rounded-md text-[13px] bg-accent border border-accent text-white no-underline hover:bg-accent-light"
              >
                Apply Now
              </a>
            )}
            {job.draft_message && (
              <button
                className="px-3.5 py-1.5 rounded-md text-[13px] bg-accent border border-accent text-white cursor-pointer hover:bg-accent-light"
                onClick={copyDraft}
              >
                {copyLabel}
              </button>
            )}
            {job.job_url && (
              <a href={absUrl(job.job_url)} target="_blank" rel="noopener" className="px-3.5 py-1.5 rounded-md text-[13px] border border-border bg-surface text-text no-underline hover:bg-surface-hover">
                Open Job
              </a>
            )}
            {job.post_url && (
              <a href={absUrl(job.post_url)} target="_blank" rel="noopener" className="px-3.5 py-1.5 rounded-md text-[13px] border border-border bg-surface text-text no-underline hover:bg-surface-hover">
                View Post
              </a>
            )}
            {job.poster_url && (
              <a href={absUrl(job.poster_url)} target="_blank" rel="noopener" className="px-3.5 py-1.5 rounded-md text-[13px] border border-border bg-surface text-text no-underline hover:bg-surface-hover">
                Poster Profile
              </a>
            )}
            {job.recruiter_url && job.recruiter_url !== job.poster_url && (
              <a href={absUrl(job.recruiter_url)} target="_blank" rel="noopener" className="px-3.5 py-1.5 rounded-md text-[13px] border border-border bg-surface text-text no-underline hover:bg-surface-hover">
                Recruiter
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
