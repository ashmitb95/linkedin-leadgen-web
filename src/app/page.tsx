"use client";

import { useState, useEffect, useCallback } from "react";
import type { Lead, LeadStats } from "@/lib/schema";
import StatsBar from "@/components/StatsBar";
import FilterBar, { type FilterGroup } from "@/components/FilterBar";
import LeadCard from "@/components/leads/LeadCard";

const filterGroups: FilterGroup[] = [
  {
    label: "Status",
    key: "status",
    options: [
      { label: "All", value: "" },
      { label: "New", value: "new" },
      { label: "Contacted", value: "contacted" },
      { label: "Replied", value: "replied" },
      { label: "Archived", value: "archived" },
    ],
  },
  {
    label: "Tier",
    key: "tier",
    options: [
      { label: "All", value: "" },
      { label: "T1 Freelance", value: "1" },
      { label: "T2 Product", value: "2" },
      { label: "T3 AI Scale", value: "3" },
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
      { label: "Relevance", value: "relevance" },
    ],
  },
];

function formatDateLabel(dateKey: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LeadsDashboard() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    status: "",
    tier: "",
    urgency: "",
    sort: "recent",
  });

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    setStats(await res.json());
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.tier) params.set("tier", filters.tier);
    if (filters.urgency) params.set("urgency", filters.urgency);
    if (filters.sort) params.set("sort", filters.sort);

    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadStats();
    loadLeads();
  }, [loadStats, loadLeads]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function exportQueryString() {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.tier) params.set("tier", filters.tier);
    if (filters.urgency) params.set("urgency", filters.urgency);
    return params.toString();
  }

  // Group leads by date
  const groupedLeads = new Map<string, Lead[]>();
  for (const lead of leads) {
    const dateKey = lead.found_at ? lead.found_at.split("T")[0] : "Unknown";
    if (!groupedLeads.has(dateKey)) groupedLeads.set(dateKey, []);
    groupedLeads.get(dateKey)!.push(lead);
  }

  const statsItems = stats
    ? [
        { label: "Total Leads", value: stats.total_leads },
        { label: "New Today", value: stats.today_new, colorClass: "text-green" },
        { label: "New", value: stats.new_leads, colorClass: "text-blue" },
        { label: "Contacted", value: stats.contacted, colorClass: "text-yellow" },
        { label: "Replied", value: stats.replied, colorClass: "text-green" },
        { label: "Archived", value: stats.archived },
      ]
    : [];

  return (
    <>
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-border">
        <h1 className="text-xl font-semibold">
          <span className="text-accent-light">LinkedIn</span> Lead Gen Dashboard
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => { loadStats(); loadLeads(); }}
            className="px-4 py-2 bg-surface border border-border text-text rounded-md text-[13px] cursor-pointer hover:bg-surface-hover"
          >
            Refresh
          </button>
          <button
            onClick={() => { window.location.href = `/api/export/xlsx?${exportQueryString()}`; }}
            className="px-4 py-2 bg-surface border border-border text-text rounded-md text-[13px] cursor-pointer hover:bg-surface-hover"
          >
            Export XLSX
          </button>
          <button
            onClick={() => { window.location.href = `/api/export/html?${exportQueryString()}`; }}
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
          <div className="text-center py-10 text-text-muted">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-15">
            <h3 className="text-lg mb-2 text-text">No leads found</h3>
            <p className="text-text-muted">Run the linkedin-leadgen pipeline to start finding leads, or adjust your filters.</p>
          </div>
        ) : (
          Array.from(groupedLeads.entries()).map(([dateKey, dateLeads]) => (
            <div key={dateKey}>
              <div className="text-[13px] font-semibold text-accent-light py-3 pb-1.5 border-b border-border mt-2 first:mt-0">
                {formatDateLabel(dateKey)}{" "}
                <span className="text-xs font-normal text-text-muted ml-1.5">{dateLeads.length}</span>
              </div>
              {dateLeads.map((lead) => (
                <div key={lead.id} className="mt-2">
                  <LeadCard lead={lead} onStatusChange={loadStats} />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
