import JobDashboard from "@/components/jobs/JobDashboard";

// Matches the target domains in config/anusha-job-profile.json plus the
// fallback buckets the scorer can emit.
const ANUSHA_DOMAINS = [
  { label: "Life Sciences", value: "Life Sciences" },
  { label: "Pharma", value: "Pharma" },
  { label: "Biotech", value: "Biotech" },
  { label: "Healthcare", value: "Healthcare" },
  { label: "MedTech", value: "MedTech" },
  { label: "Adjacent", value: "Adjacent" },
  { label: "Off-domain", value: "Off-domain" },
];

export default function AnushaJobsPage() {
  return (
    <JobDashboard
      title="Search — Anusha"
      apiPrefix="/api/anusha-jobs"
      statsEndpoint="/api/anusha-job-stats"
      exportCsvPath="/api/anusha-jobs/export/csv"
      exportHtmlPath="/api/anusha-jobs/export/html"
      domainOptions={ANUSHA_DOMAINS}
    />
  );
}
