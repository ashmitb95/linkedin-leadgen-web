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
      {/* Header */}
      <header className="page-header">
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
          <span style={{ color: "#818cf8" }}>LinkedIn</span> Lead Gen Dashboard
        </h1>
        <div className="header-actions">
          <button className="btn" onClick={() => { loadStats(); loadLeads(); }}>Refresh</button>
          <button className="btn" onClick={() => { window.location.href = `/api/export/xlsx?${exportQueryString()}`; }}>Export XLSX</button>
          <button className="btn btn-primary" onClick={() => { window.location.href = `/api/export/html?${exportQueryString()}`; }}>Export Report</button>
        </div>
      </header>

      {stats && <StatsBar stats={statsItems} />}

      <FilterBar groups={filterGroups} current={filters} onChange={handleFilterChange} />

      {/* Lead list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#71717a", fontSize: 14 }}>Loading leads...</div>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#fafafa" }}>No leads found</div>
            <div style={{ color: "#71717a", fontSize: 14 }}>Run the linkedin-leadgen pipeline to start finding leads, or adjust your filters.</div>
          </div>
        ) : (
          Array.from(groupedLeads.entries()).map(([dateKey, dateLeads]) => (
            <div key={dateKey}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#818cf8", padding: "16px 0 8px", marginTop: 8 }}>
                {formatDateLabel(dateKey)}
                <span style={{ fontSize: 12, fontWeight: 400, color: "#71717a", marginLeft: 8 }}>{dateLeads.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {dateLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onStatusChange={loadStats} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
