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
];

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
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-border">
        <h1 className="text-xl font-semibold">
          <span className="text-accent-light">Job</span> {title}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => { loadStats(); loadJobs(); }}
            className="px-4 py-2 bg-surface border border-border text-text rounded-md text-[13px] cursor-pointer hover:bg-surface-hover"
          >
            Refresh
          </button>
          <button
            onClick={() => { window.location.href = `${exportCsvPath}?${exportQueryString()}`; }}
            className="px-4 py-2 bg-surface border border-border text-text rounded-md text-[13px] cursor-pointer hover:bg-surface-hover"
          >
            Export CSV
          </button>
          <button
            onClick={() => { window.location.href = `${exportHtmlPath}?${exportQueryString()}`; }}
            className="px-4 py-2 bg-accent border border-accent text-white rounded-md text-[13px] cursor-pointer hover:bg-accent-light"
          >
            Export Report
          </button>
        </div>
      </header>

      {stats && <StatsBar stats={statsItems} />}

      <FilterBar groups={filterGroups} current={filters} onChange={handleFilterChange} />

      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="text-center py-10 text-text-muted">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-15">
            <h3 className="text-lg mb-2 text-text">No jobs found</h3>
            <p className="text-text-muted">Run the job search pipeline to find jobs, or adjust your filters.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              apiPrefix={apiPrefix}
              onStatusChange={() => { loadStats(); }}
            />
          ))
        )}
      </div>
    </>
  );
}
