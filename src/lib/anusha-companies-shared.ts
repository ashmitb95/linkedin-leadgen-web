// Types and constants shared by the companies API and the client components.
// Kept free of DB imports so client code can use them.

export const OUTREACH_STATUSES = ["messaged", "replied", "call", "not_interested"] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const CONTACT_LABELS = ["hiring_manager", "referrer", "recruiter", "not_relevant"] as const;
export type ContactLabel = (typeof CONTACT_LABELS)[number];

// A contact still at "messaged" this many days later is due a follow-up.
export const FOLLOW_UP_DAYS = 4;

export interface CompanyJob {
  title: string;
  location: string;
  posted: string;
  url: string;
  relevant: boolean;
}

export interface CompanySummary {
  slug: string;
  name: string;
  tier: number;
  cities: string[];
  type: string;
  website: string;
  relevantJobs: number;
  contacts: number;
  alumni: number;
  progress: "none" | "started" | "replied";
}

export interface CompanyDetail extends Omit<CompanySummary, "relevantJobs" | "contacts" | "alumni" | "progress"> {
  hook: string;
  teams: string;
  linkedinUrl: string;
  careersUrl: string;
  industry: string;
  size: string;
  headquarters: string;
  jobsSearchUrl: string;
  jobs: CompanyJob[];
}

export interface Outreach {
  status: OutreachStatus;
  statusAt: string;
  messagedAt: string;
  notes: string;
}

export interface Contact {
  id: string;
  name: string;
  headline: string;
  currentRole: string;
  location: string;
  degree: string;
  isAlumni: boolean;
  profileUrl: string;
  label: ContactLabel | "";
  score: number;
  reason: string;
  email: string;
  emailStatus: "verified" | "likely" | "guess" | "not_found" | "";
  emailNote: string;
  outreach: Outreach | null;
}

export interface OutreachStats {
  reachedOut: number;
  replied: number;
  followUpsDue: number;
}
