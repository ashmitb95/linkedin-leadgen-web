export interface Lead {
  id: string;
  name: string;
  headline: string | null;
  company: string | null;
  profile_url: string;
  post_content: string | null;
  post_url: string | null;
  keyword_match: string | null;
  tier: number;
  relevance: number;
  urgency: string;
  draft_message: string | null;
  status: string;
  found_at: string;
  updated_at: string;
  contact_email: string | null;
  contact_info: string | null;
  post_date: string | null;
}

export interface Job {
  id: string;
  dedup_key: string;
  source: string;
  title: string;
  company: string;
  location: string;
  work_mode: string;
  salary_range: string | null;
  job_url: string;
  apply_url: string;
  job_description: string;
  recruiter_name: string;
  recruiter_email: string;
  recruiter_url: string;
  poster_name: string;
  poster_headline: string;
  poster_url: string;
  post_content: string;
  post_url: string;
  fit_score: number;
  stack_match: number;
  seniority_match: string;
  urgency: string;
  reasoning: string;
  draft_message: string;
  keyword_match: string;
  status: string;
  notes: string;
  found_at: string;
  updated_at: string;
}

export interface Run {
  id: number;
  started_at: string;
  completed_at: string | null;
  searches_run: number;
  leads_found: number;
  leads_new: number;
}

export interface JobRun {
  id: number;
  started_at: string;
  completed_at: string | null;
  searches_run: number;
  jobs_found: number;
  jobs_new: number;
}

export interface LeadFilters {
  status?: string;
  tier?: number;
  urgency?: string;
  sort?: "recent" | "relevance";
  limit?: number;
  offset?: number;
}

export interface JobFilters {
  status?: string;
  work_mode?: string;
  urgency?: string;
  min_fit?: number;
  limit?: number;
  offset?: number;
}

export interface LeadStats {
  total_leads: number;
  new_leads: number;
  contacted: number;
  replied: number;
  archived: number;
  by_tier: { tier: number; count: number }[];
  by_urgency: { urgency: string; count: number }[];
  recent_runs: Run[];
  today_new: number;
}

export interface JobStats {
  total_jobs: number;
  new_jobs: number;
  saved: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
  archived: number;
  by_work_mode: { work_mode: string; count: number }[];
  by_seniority: { seniority_match: string; count: number }[];
  recent_runs: JobRun[];
  today_new: number;
}
