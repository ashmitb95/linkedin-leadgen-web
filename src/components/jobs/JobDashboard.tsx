"use client";

import { useState, useEffect, useCallback } from "react";
import type { Job, JobStats } from "@/lib/schema";
import StatsBar from "@/components/StatsBar";
import FilterBar, { type FilterGroup } from "@/components/FilterBar";
import JobCard from "@/components/jobs/JobCard";

const filterGroups: FilterGroup[] = [
  {
    label: "Status",
    key: "status",
    options: [
      { label: "All", value: "" },
      { label: "New", value: "new" },
      { label: "Saved", value: "saved" },
      { label: "Applied", value: "applied" },
      { label: "Interviewing", value: "interviewing" },
      { label: "Offer", value: "offer" },
      { label: "Rejected", value: "rejected" },
      { label: "Archived", value: "archived" },
    ],
  },
  {
    label: "Work Mode",
    key: "work_mode",
    options: [
      { label: "All", value: "" },
      { label: "Remote", value: "remote" },
      { label: "Hybrid", value: "hybrid" },
      { label: "Onsite", value: "onsite" },
    ],
  },
  {
    label: "Urgency",
    key: "urgency",
    options: [
      { label: "All", value: "" },
      { label: "High", value: "high" },
      { label: "Medium", value: "medium" },
      { label: "Low", value: "low" },
    ],
  },
  {
    label: "Sort",
    key: "sort",
    options: [
      { label: "Most Recent", value: "recent" },
      { label: "Fit Score", value: "fit" },
    ],
  },
];

function formatDateLabel(dateKey: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface JobDashboardProps {
  title: string;
  apiPrefix: string;
  statsEndpoint: string;
  exportCsvPath: string;
  exportHtmlPath: string;
}

export default function JobDashboard({
  title,
  apiPrefix,
  statsEndpoint,
  exportCsvPath,
  exportHtmlPath,
}: JobDashboardProps) {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    status: "",
    work_mode: "",
    urgency: "",
    sort: "recent",
  });

  const loadStats = useCallback(async () => {
    const res = await fetch(statsEndpoint);
    setStats(await res.json());
  }, [statsEndpoint]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.work_mode) params.set("work_mode", filters.work_mode);
    if (filters.urgency) params.set("urgency", filters.urgency);
    if (filters.sort) params.set("sort", filters.sort);

    const res = await fetch(`${apiPrefix}?${params}`);
    const data = await res.json();
    setJobs(data.jobs);
    setLoading(false);
  }, [apiPrefix, filters]);

  useEffect(() => {
    loadStats();
    loadJobs();
  }, [loadStats, loadJobs]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function exportQueryString() {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.work_mode) params.set("work_mode", filters.work_mode);
    if (filters.urgency) params.set("urgency", filters.urgency);
    return params.toString();
  }

  // Group jobs by date
  const groupedJobs = new Map<string, Job[]>();
  for (const job of jobs) {
    const dateKey = job.found_at ? job.found_at.split("T")[0] : "Unknown";
    if (!groupedJobs.has(dateKey)) groupedJobs.set(dateKey, []);
    groupedJobs.get(dateKey)!.push(job);
  }

  const statsItems = stats
    ? [
        { label: "Total Jobs", value: stats.total_jobs },
        { label: "New Today", value: stats.today_new, colorClass: "text-green" },
        { label: "New", value: stats.new_jobs, colorClass: "text-blue" },
        { label: "Saved", value: stats.saved, colorClass: "text-yellow" },
        { label: "Applied", value: stats.applied, colorClass: "text-orange" },
        { label: "Interviewing", value: stats.interviewing, colorClass: "text-green" },
        { label: "Offers", value: stats.offer, colorClass: "text-purple" },
      ]
    : [];

  return (
    <>
      {/* Header */}
      <header className="page-header">
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
          <span style={{ color: "#818cf8" }}>Job</span> {title}
        </h1>
        <div className="header-actions">
          <button className="btn" onClick={() => { loadStats(); loadJobs(); }}>Refresh</button>
          <button className="btn" onClick={() => { window.location.href = `${exportCsvPath}?${exportQueryString()}`; }}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => { window.location.href = `${exportHtmlPath}?${exportQueryString()}`; }}>Export Report</button>
        </div>
      </header>

      {stats && <StatsBar stats={statsItems} />}

      <FilterBar groups={filterGroups} current={filters} onChange={handleFilterChange} />

      {/* Job list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#71717a", fontSize: 14 }}>Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#fafafa" }}>No jobs found</div>
            <div style={{ color: "#71717a", fontSize: 14 }}>Run the job search pipeline to find jobs, or adjust your filters.</div>
          </div>
        ) : (
          Array.from(groupedJobs.entries()).map(([dateKey, dateJobs]) => (
            <div key={dateKey}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#818cf8", padding: "16px 0 8px", marginTop: 8 }}>
                {formatDateLabel(dateKey)}
                <span style={{ fontSize: 12, fontWeight: 400, color: "#71717a", marginLeft: 8 }}>{dateJobs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {dateJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    apiPrefix={apiPrefix}
                    onStatusChange={() => { loadStats(); }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
