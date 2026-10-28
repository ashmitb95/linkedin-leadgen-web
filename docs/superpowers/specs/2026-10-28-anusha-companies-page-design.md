# Anusha — Companies & Outreach page

Date: 2026-10-28

## Goal

Replace Anusha's job-scraper dashboard with one page built around the 40 curated
target companies (Bengaluru / Hyderabad life sciences): who to contact at each,
open jobs, and a lightweight tracker of who she has messaged.

## Decisions

- **Layout (mockup B):** left column = visual company list (logo, city, tag,
  progress dot: grey none / amber started / green replied). Right = one company
  profile: header, website / careers / LinkedIn links, "Why you fit", best
  people, matching jobs. Stats strip on top: reached out, replied, follow-ups due.
  Stacks to list → profile (with back) under 900px. Built in the app's existing
  dark palette.
- **Components over text:** favicon logos, initial avatars, colour-coded tags
  (Top pick, Ex-Bharat Biotech, Ashmit's connection / mutual via Ashmit, AI role
  label), one primary action per person.
- **Tracker:** one click "I messaged" → status `messaged` with today's date.
  Then one click to `replied`, `call`, `not_interested`, or undo. Optional note.
  "Follow-ups due" = `messaged` for more than 4 days (derived, not stored).
- **Contact ranking:** at import, Claude Haiku 5.5 labels every contact against
  her profile: `hiring_manager`, `referrer`, `recruiter`, `not_relevant`, plus a
  0–100 score and a one-line reason. Profile shows the top 3, "Show all" for the
  rest of the relevant ones, and not-relevant contacts behind a separate toggle.
  Already-ranked contacts are skipped on re-import.
- **Nav:** her menu shows only the new page. The old pages stay reachable by URL
  (`/anusha/jobs` — the old dashboard moves there — and `/anusha/track`).
  `auth.ts` gains a per-role list of hidden-but-allowed pages.

## Data

Three new tables in the existing Turso DB (`scripts/db-init.ts`):

- `anusha_companies` — slug PK, sort order, config fields (name, tier, cities,
  type, hook, teams), crawl fields (LinkedIn URL/id, website, careers URL,
  industry, size, HQ, jobs search URL), `jobs` JSON column, crawled_at.
- `anusha_contacts` — id PK (LinkedIn `/in/` slug), company slug, name,
  headline, current role, location, degree, search group, is_alumni,
  profile URL, ai_label, ai_score, ai_reason.
- `anusha_outreach` — contact id PK, status, status_at, messaged_at, notes.
  Never written by the import, so re-crawls never touch her progress.

Flow: `anusha:companies` (crawl → local JSON) → `anusha:import` (rank new
contacts, upsert companies + contacts) → page reads Turso via:

- `GET /api/anusha-companies` — list + stats
- `GET /api/anusha-companies/[slug]` — one company with contacts + outreach
- `PUT /api/anusha-outreach/[contactId]` — `{ status | null, notes? }`

## Out of scope (later)

Email-address guessing, message templates, re-crawl scheduling, the parked
crawl gaps (Course5, Novartis jobs).
