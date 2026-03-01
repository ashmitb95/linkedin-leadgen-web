"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Lead, LeadStats } from "@/lib/schema";
import StatsBar from "@/components/StatsBar";
import FilterBar, { type FilterGroup } from "@/components/FilterBar";
import LeadCard from "@/components/leads/LeadCard";
import LeadTable from "@/components/leads/LeadTable";
import DetailSidebar from "@/components/DetailSidebar";
import LeadDetail from "@/components/leads/LeadDetail";

const filterGroups: FilterGroup[] = [
  {
    label: "Status",
    key: "status",
    options: [
      { label: "All", value: "" },
      { label: "Needs Triage", value: "new" },
      { label: "Message Sent", value: "message_sent" },
      { label: "Reply Received", value: "reply_received" },
      { label: "Meeting Booked", value: "meeting_booked" },
      { label: "Converted", value: "client_converted" },
      { label: "Churned", value: "client_churned" },
      { label: "Invalid", value: "invalid" },
    ],
  },
  {
    label: "Type",
    key: "type",
    options: [
      { label: "All", value: "" },
      { label: "Tech", value: "tech" },
      { label: "Branding", value: "branding" },
    ],
  },
  {
    label: "Source",
    key: "source",
    options: [
      { label: "All", value: "" },
      { label: "Content", value: "content" },
      { label: "Sales Nav", value: "salesnav" },
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

const STORAGE_KEY_FILTERS = "leadgen_filters";
const STORAGE_KEY_VIEW = "leadgen_viewMode";

const DEFAULT_FILTERS: Record<string, string> = {
  status: "",
  type: "",
  source: "",
  urgency: "",
  sort: "recent",
};

function loadStoredFilters(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FILTERS);
    if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_FILTERS;
}

function loadStoredViewMode(): "table" | "cards" {
  if (typeof window === "undefined") return "cards";
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VIEW);
    if (raw === "table") return "table";
    if (raw === "cards") return "cards";
  } catch {}
  return "cards";
}

export default function LeadsDashboard() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(loadStoredViewMode);
  const [filters, setFilters] = useState<Record<string, string>>(loadStoredFilters);
  const isInitialMount = useRef(true);

  // Persist filters to localStorage
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
    } catch {}
  }, [filters]);

  // Persist view mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, viewMode);
    } catch {}
  }, [viewMode]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats", { cache: "no-store" });
    setStats(await res.json());
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.source) params.set("source", filters.source);
    if (filters.urgency) params.set("urgency", filters.urgency);
    if (filters.sort) params.set("sort", filters.sort);

    const res = await fetch(`/api/leads?${params}`, { cache: "no-store" });
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
    if (filters.type) params.set("type", filters.type);
    if (filters.source) params.set("source", filters.source);
    if (filters.urgency) params.set("urgency", filters.urgency);
    return params.toString();
  }

  // Group leads by date (used by cards view)
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
        { label: "Needs Triage", value: stats.new_leads, colorClass: "text-blue" },
        { label: "Msg Sent", value: stats.message_sent, colorClass: "text-yellow" },
        { label: "Replies", value: stats.reply_received, colorClass: "text-green" },
        { label: "Meetings", value: stats.meeting_booked, colorClass: "text-accent-light" },
        { label: "Converted", value: stats.client_converted, colorClass: "text-green" },
      ]
    : [];

  const handleLeadUpdated = useCallback(() => {
    loadStats();
    loadLeads();
  }, [loadStats, loadLeads]);

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

      <div className="filter-toolbar">
        <FilterBar groups={filterGroups} current={filters} onChange={handleFilterChange} />
        <div className="view-toggle">
          <button
            className={viewMode === "table" ? "active" : ""}
            onClick={() => setViewMode("table")}
            title="Table view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="1" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.9"/>
              <rect x="9" y="1" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.5"/>
              <rect x="1" y="6" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.9"/>
              <rect x="9" y="6" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.5"/>
              <rect x="1" y="11" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.9"/>
              <rect x="9" y="11" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.5"/>
            </svg>
            Table
          </button>
          <button
            className={viewMode === "cards" ? "active" : ""}
            onClick={() => setViewMode("cards")}
            title="Card view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="1" width="14" height="4" rx="1" fill="currentColor" opacity="0.9"/>
              <rect x="1" y="7" width="14" height="4" rx="1" fill="currentColor" opacity="0.6"/>
              <rect x="1" y="13" width="14" height="2" rx="1" fill="currentColor" opacity="0.3"/>
            </svg>
            Cards
          </button>
        </div>
      </div>

      {/* Lead content */}
      {viewMode === "table" ? (
        <LeadTable
          leads={leads}
          loading={loading}
          onSelectLead={setSelectedLead}
          onLeadUpdated={handleLeadUpdated}
        />
      ) : (
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
                    <LeadCard key={lead.id} lead={lead} onSelect={setSelectedLead} onStatusChange={handleLeadUpdated} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sidebar */}
      <DetailSidebar open={!!selectedLead} onClose={() => setSelectedLead(null)}>
        {selectedLead && (
          <LeadDetail
            lead={selectedLead}
            onStatusChange={handleLeadUpdated}
          />
        )}
      </DetailSidebar>
    </>
  );
}
