import JobDashboard from "@/components/jobs/JobDashboard";

export default function AnushaJobsPage() {
  return (
    <JobDashboard
      title="Search — Anusha"
      apiPrefix="/api/anusha-jobs"
      statsEndpoint="/api/anusha-job-stats"
      exportCsvPath="/api/anusha-jobs/export/csv"
      exportHtmlPath="/api/anusha-jobs/export/html"
    />
  );
}
