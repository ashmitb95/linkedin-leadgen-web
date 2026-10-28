"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CompanyDetail,
  CompanySummary,
  Contact,
  OutreachStats,
  OutreachStatus,
} from "@/lib/anusha-companies-shared";
import CompanyList from "./CompanyList";
import CompanyProfile from "./CompanyProfile";
import "./companies.css";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ company: CompanyDetail; contacts: Contact[] } | null>(null);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    const res = await fetch("/api/anusha-companies");
    if (!res.ok) throw new Error(`Couldn't load companies (${res.status})`);
    const data = await res.json();
    setCompanies(data.companies);
    setStats(data.stats);
    return data.companies as CompanySummary[];
  }, []);

  const loadDetail = useCallback(async (slug: string) => {
    const res = await fetch(`/api/anusha-companies/${slug}`);
    if (!res.ok) throw new Error(`Couldn't load company (${res.status})`);
    setDetail(await res.json());
  }, []);

  useEffect(() => {
    loadList()
      .then((list) => {
        // On wide screens open the first company; on phones start at the list.
        if (list.length && window.matchMedia("(min-width: 901px)").matches) setSelected(list[0].slug);
      })
      .catch((e) => setError(e.message));
  }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    loadDetail(selected).catch((e) => setError(e.message));
  }, [selected, loadDetail]);

  async function saveOutreach(contactId: string, update: { status: OutreachStatus | null; notes?: string }) {
    const res = await fetch(`/api/anusha-outreach/${encodeURIComponent(contactId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      setError("Couldn't save that — please try again.");
      return;
    }
    setError("");
    await Promise.all([selected ? loadDetail(selected) : null, loadList()]);
  }

  return (
    <div className={selected ? "ac-root ac-has-selection" : "ac-root"}>
      <div className="ac-top">
        <div>
          <h1>Your target companies</h1>
          <p>{companies.length} life-sciences companies in Bengaluru &amp; Hyderabad, with the people to reach at each.</p>
        </div>
        {stats && (
          <div className="ac-stats">
            <div className="ac-stat"><b>{stats.reachedOut}</b><span>reached out</span></div>
            <div className="ac-stat"><b>{stats.replied}</b><span>replied</span></div>
            <div className={stats.followUpsDue ? "ac-stat ac-due" : "ac-stat"}><b>{stats.followUpsDue}</b><span>follow-ups due</span></div>
          </div>
        )}
      </div>

      {error && <div className="ac-empty" style={{ marginBottom: 16, color: "#fca5a5" }}>{error}</div>}

      <div className="ac-panes">
        <CompanyList companies={companies} selected={selected} onSelect={setSelected} />
        <div className="ac-profile">
          <button className="ac-btn ac-btn-ghost ac-back" onClick={() => setSelected(null)}>← All companies</button>
          {detail ? (
            <CompanyProfile key={detail.company.slug} company={detail.company} contacts={detail.contacts} onSave={saveOutreach} />
          ) : (
            <div className="ac-loading">{selected ? "Loading…" : "Pick a company on the left."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
