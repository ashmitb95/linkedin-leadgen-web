import JobDashboard from "@/components/jobs/JobDashboard";

export default function TanmayJobsPage() {
  return (
    <JobDashboard
      title="Search — Tanmay"
      apiPrefix="/api/tanmay-jobs"
      statsEndpoint="/api/tanmay-job-stats"
      exportCsvPath="/api/tanmay-jobs/export/csv"
      exportHtmlPath="/api/tanmay-jobs/export/html"
    />
  );
}
