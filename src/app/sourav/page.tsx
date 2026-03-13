import JobDashboard from "@/components/jobs/JobDashboard";

export default function SouravJobsPage() {
  return (
    <JobDashboard
      title="Search — Sourav"
      apiPrefix="/api/sourav-jobs"
      statsEndpoint="/api/sourav-job-stats"
      exportCsvPath="/api/sourav-jobs/export/csv"
      exportHtmlPath="/api/sourav-jobs/export/html"
    />
  );
}
