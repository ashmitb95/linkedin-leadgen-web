import JobDashboard from "@/components/jobs/JobDashboard";

export default function JobsPage() {
  return (
    <JobDashboard
      title="Search Dashboard"
      apiPrefix="/api/jobs"
      statsEndpoint="/api/job-stats"
      exportCsvPath="/api/jobs/export/csv"
      exportHtmlPath="/api/jobs/export/html"
    />
  );
}
