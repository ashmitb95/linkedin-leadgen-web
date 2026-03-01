# LinkedIn LeadGen Web

Next.js dashboard and pipeline runner for automated LinkedIn prospecting and job search. Uses browser automation (Playwright CDP) and Claude AI to discover, extract, score, and surface leads and job opportunities.

**Two independent pipelines:**

| Pipeline | Purpose | Sources | Database |
|----------|---------|---------|----------|
| **Lead Gen** | Find freelance/project clients | LinkedIn Content, Sales Navigator | Turso (cloud SQLite) |
| **Job Search** | Find senior engineering roles | LinkedIn Content, LinkedIn Jobs, Naukri, Hirist | Turso (cloud SQLite) |

Both pipelines share the same architecture: **Browser → Extract → Claude Score → Turso → Next.js Dashboard**

## How It Works

1. **Browser automation** — Connects to a Chrome instance via CDP (port 18800). Executes vanilla JS to scroll pages and extract DOM content.
2. **Smart DOM extraction** — Uses profile links (`/in/`, `/jobs/view/`) as stable anchors, walks up the DOM tree to find card containers. No fragile CSS selectors.
3. **Claude AI scoring** — Sends extracted text blocks to Claude for parsing, scoring, and personalized message drafting.
4. **Turso storage** — Cloud-hosted LibSQL database. Deduplicates by SHA256 hash. Upserts preserve higher scores via COALESCE.
5. **Next.js dashboard** — Auth-protected dashboard with table (AG Grid) and card views, inline editing, filtering, and export.

## Prerequisites

- **Node.js** >= 18
- **Turso account** — Cloud SQLite database ([turso.tech](https://turso.tech))
- **Anthropic API key** — For Claude scoring
- **LinkedIn account** — Logged into Chrome with remote debugging enabled
- **Chrome/Chromium** — Launched with `--remote-debugging-port` flag

## Setup

```bash
git clone <repo-url>
cd linkedin-leadgen-web
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
# Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_DATABASE_TOKEN=your-turso-token

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Auth — comma-separated user:password pairs
AUTH_USERS=admin:your-password,viewer:viewer-pass
AUTH_SECRET=your-random-secret-string

# Browser (optional, default 18800)
CDP_PORT=18800
```

### Initialize Database

```bash
npm run db:init
```

### Browser Setup

The pipeline launches its own Chromium browser with a **persistent profile** stored in `.browser-profile/`. This means:

- No need to manually launch Chrome with special flags
- LinkedIn login session is saved locally and reused across runs
- Doesn't interfere with your personal Chrome

**First run:** Chromium will open and navigate to LinkedIn. Log in manually when prompted. Your session is saved automatically — subsequent runs will reuse it.

**If your session expires:** The pipeline will detect it and ask you to log in again.

#### Alternative: CDP Mode

If you prefer to connect to your own Chrome instance (e.g., with extensions or a specific profile), set `CDP_PORT` or `USE_CDP=true` in `.env.local`:

```bash
# .env.local
CDP_PORT=18800
```

Then launch Chrome with remote debugging before running the pipeline:
```bash
# Quit Chrome fully first, then:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=18800
```

## Running the Dashboard

```bash
npm run dev       # Development mode (http://localhost:3000)
npm run build     # Production build
npm run start     # Production server
```

The dashboard requires login. Credentials are defined in `AUTH_USERS` in your `.env.local`.

## Running the Pipelines

> Make sure Chrome is running with `--remote-debugging-port=18800` and you're logged into LinkedIn before running pipelines.

### Lead Generation

```bash
npm run lead:run              # Full run — content + Sales Navigator
npm run lead:run:test         # Test mode — 1 keyword only
npm run lead:run:content      # Content search only
npm run lead:run:salesnav     # Sales Navigator only
npm run lead:run:tech         # Tech/dev keywords only
npm run lead:run:branding     # Branding keywords only
npm run rescore               # Re-score existing leads
```

**CLI flags:**
```bash
npx tsx scripts/lead-run.ts --max 2              # Limit searches per mode
npx tsx scripts/lead-run.ts --keyword "test"     # Single keyword test
npx tsx scripts/lead-run.ts --content-only       # Content search only
npx tsx scripts/lead-run.ts --salesnav-only      # Sales Nav only
npx tsx scripts/lead-run.ts --dev-only           # Dev keywords only
npx tsx scripts/lead-run.ts --branding-only      # Branding keywords only
```

### Job Search

```bash
npm run job:run               # Full run — all sources
npm run job:run:quick         # Quick test (1 keyword/source)
npm run job:run:linkedin      # LinkedIn only
npm run job:run:naukri        # Naukri.com only
npm run job:run:hirist        # Hirist.tech only
```

## Configuration

### `config/keywords.json` — Lead Gen Keywords

```json
{
  "content_search": {
    "keywords": ["looking for a freelance developer", "..."],
    "branding_keywords": ["..."],
    "max_per_run": 6
  },
  "sales_nav_search": {
    "keywords": ["founder MVP", "..."],
    "branding_keywords": ["..."],
    "max_per_run": 4
  }
}
```

### `config/templates.json` — Message Templates

Three tiers of outreach templates with `{{name}}` and `{{topic}}` placeholders.

### `config/job-keywords.json` — Job Search Keywords

Keywords and scroll config for LinkedIn, Naukri, and Hirist searches.

### `config/job-profile.json` — Candidate Profile

Defines tech stack, target roles, seniority, and location preferences used by Claude for job scoring.

## API Reference

### Lead Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leads` | List leads (query: `status`, `tier`, `urgency`, `source`, `sort`) |
| `GET` | `/api/leads/:id` | Get single lead |
| `PATCH` | `/api/leads/:id` | Update lead fields (status, urgency, contact_email, contact_info) |
| `GET` | `/api/stats` | Aggregate statistics |
| `GET` | `/api/runs` | Pipeline run history |
| `GET` | `/api/digest` | Daily digest |
| `GET` | `/api/export/xlsx` | Export as Excel |
| `GET` | `/api/export/html` | Export as styled HTML report |

### Job Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs` | List jobs |
| `GET` | `/api/jobs/:id` | Get single job |
| `PATCH` | `/api/jobs/:id` | Update job status + notes |
| `GET` | `/api/job-stats` | Aggregate statistics |
| `GET` | `/api/job-digest` | Daily digest |
| `GET` | `/api/jobs/export/csv` | Export as CSV |
| `GET` | `/api/jobs/export/html` | Export as HTML report |

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login with username/password |
| `POST` | `/api/auth/logout` | Clear auth cookies |

## Project Structure

```
linkedin-leadgen-web/
├── config/
│   ├── keywords.json           # Lead gen search keywords
│   ├── templates.json          # Outreach message templates
│   ├── job-keywords.json       # Job search keywords + config
│   └── job-profile.json        # Candidate profile for job scoring
├── scripts/
│   ├── lead-run.ts             # Lead gen pipeline runner
│   ├── job-run.ts              # Job search pipeline runner
│   ├── db-init.ts              # Database initialization
│   └── rescore.ts              # Re-score existing leads
├── src/
│   ├── app/
│   │   ├── page.tsx            # Lead dashboard (main page)
│   │   ├── jobs/page.tsx       # Job dashboard
│   │   ├── login/page.tsx      # Login page
│   │   ├── globals.css         # Global styles (dark theme)
│   │   └── api/                # Next.js API routes
│   ├── components/
│   │   ├── NavBar.tsx          # Navigation bar
│   │   ├── FilterBar.tsx       # Filter dropdowns
│   │   └── leads/
│   │       ├── LeadTable.tsx   # AG Grid table view
│   │       ├── LeadCard.tsx    # Card view
│   │       └── DetailSidebar.tsx
│   └── lib/
│       ├── db.ts               # Turso/LibSQL connection
│       ├── leads.ts            # Lead queries
│       ├── jobs.ts             # Job queries
│       ├── auth.ts             # Auth + role config
│       └── pipeline/           # Browser automation + extraction
├── .env.local                  # Environment variables (not committed)
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Next.js 16** + **React 19** — App router, server components, API routes
- **AG Grid Community** — Table view with inline editing
- **Playwright** — CDP browser connection for pipeline scripts
- **Anthropic SDK** — Claude API for extraction and scoring
- **Turso / LibSQL** — Cloud-hosted SQLite database
- **TypeScript** — Full type safety throughout

## License

MIT
