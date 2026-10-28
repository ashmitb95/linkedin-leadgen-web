"use client";

import { useState } from "react";
import type { CompanyDetail, Contact, OutreachStatus } from "@/lib/anusha-companies-shared";
import { CompanyLogo } from "./bits";
import ContactCard from "./ContactCard";

const TOP_PEOPLE = 3;
const TOP_JOBS = 3;

// LinkedIn's "N days ago" style; anything under a week counts as new.
const isNew = (posted: string) => /\b(minute|hour|day)s?\b/.test(posted);

interface Props {
  company: CompanyDetail;
  contacts: Contact[];
  onSave: (contactId: string, update: { status: OutreachStatus | null; notes?: string }) => Promise<void>;
}

export default function CompanyProfile({ company, contacts, onSave }: Props) {
  const [allPeople, setAllPeople] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [allJobs, setAllJobs] = useState(false);

  // Contacts arrive sorted by AI score. Anyone she has already contacted stays visible.
  const relevant = contacts.filter((c) => c.label !== "not_relevant" || c.outreach);
  const hidden = contacts.filter((c) => c.label === "not_relevant" && !c.outreach);
  const people = allPeople ? relevant : relevant.slice(0, TOP_PEOPLE);
  const jobs = company.jobs.filter((j) => j.relevant);
  const shownJobs = allJobs ? jobs : jobs.slice(0, TOP_JOBS);

  return (
    <>
      <div className="ac-head">
        <CompanyLogo name={company.name} website={company.website} large />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2>{company.name}</h2>
            {company.tier === 1 && <span className="ac-tag ac-tag-top">★ Top pick</span>}
          </div>
          <div className="ac-meta">
            <span>📍 {company.cities.join(" · ")}</span>
            {company.size && <span>👥 {company.size}</span>}
            {company.industry && <span>🏷️ {company.industry}</span>}
          </div>
        </div>
      </div>

      <div className="ac-links">
        {company.website && <a className="ac-link" href={company.website} target="_blank" rel="noreferrer">🌐 Website</a>}
        {company.careersUrl && <a className="ac-link" href={company.careersUrl} target="_blank" rel="noreferrer">📝 Careers page</a>}
        {company.linkedinUrl && <a className="ac-link" href={company.linkedinUrl} target="_blank" rel="noreferrer">💼 LinkedIn</a>}
      </div>

      {company.hook && (
        <div className="ac-why">
          <b>Why you fit:</b> {company.hook}
          {company.teams && <small>Teams to look at: {company.teams}</small>}
        </div>
      )}

      <div className="ac-sec">
        <h3>Best people to contact</h3>
        <span style={{ fontSize: 12, color: "var(--ac-muted)" }}>{relevant.length} worth reaching</span>
      </div>
      {people.length ? (
        <div className="ac-people">
          {people.map((c) => <ContactCard key={c.id} contact={c} onSave={onSave} />)}
          {showHidden && hidden.map((c) => <ContactCard key={c.id} contact={c} onSave={onSave} />)}
        </div>
      ) : (
        <div className="ac-empty">No contacts found here yet.</div>
      )}
      <div className="ac-more-row">
        {relevant.length > TOP_PEOPLE && (
          <button className="ac-more" onClick={() => setAllPeople(!allPeople)}>
            {allPeople ? "Show fewer" : `Show all ${relevant.length} →`}
          </button>
        )}
        {hidden.length > 0 && (
          <button className="ac-more" style={{ color: "var(--ac-muted)" }} onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? "Hide less relevant" : `Show ${hidden.length} less relevant`}
          </button>
        )}
      </div>

      <div className="ac-sec">
        <h3>Jobs that match you</h3>
        {company.jobsSearchUrl && (
          <a className="ac-more" href={company.jobsSearchUrl} target="_blank" rel="noreferrer">All openings on LinkedIn ↗</a>
        )}
      </div>
      {shownJobs.length ? (
        <div className="ac-jobs">
          {shownJobs.map((j) => (
            <a key={j.url} className="ac-job" href={j.url} target="_blank" rel="noreferrer">
              <div className="ac-job-icon">💼</div>
              <div className="ac-job-text">
                <b>{j.title}</b>
                <span>{[j.location, j.posted && `posted ${j.posted}`].filter(Boolean).join(" · ")}</span>
              </div>
              {isNew(j.posted) && <span className="ac-tag ac-tag-new">New</span>}
            </a>
          ))}
        </div>
      ) : (
        <div className="ac-empty">
          No matching openings on LinkedIn right now.
          {company.careersUrl ? " Their careers page may list more — and a cold email works even without an opening." : " A cold email works even without an opening."}
        </div>
      )}
      {jobs.length > TOP_JOBS && (
        <div className="ac-more-row">
          <button className="ac-more" onClick={() => setAllJobs(!allJobs)}>
            {allJobs ? "Show fewer" : `Show all ${jobs.length} →`}
          </button>
        </div>
      )}
    </>
  );
}
