import type { Lead, Job } from "./schema";

const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function formatDateLabel(dateKey: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  if (dateKey === "Unknown") return "Unknown Date";
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Lead Exports ──

export function generateLeadHtmlReport(leads: Lead[]): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const tierLabel = (t: number) => t === 1 ? "T1 Freelance" : t === 2 ? "T2 Product" : t === 3 ? "T3 AI Scale" : "T4 Branding";
  const tierColor = (t: number) => t === 1 ? "#3b82f6" : t === 2 ? "#8b5cf6" : t === 3 ? "#f59e0b" : "#ec4899";
  const urgencyColor = (u: string) => u === "high" ? "#ef4444" : u === "medium" ? "#f59e0b" : "#6b7280";

  const leadCards = leads.map((l) => `
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid ${tierColor(l.tier)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:18px;font-weight:700;color:#1a1a2e">${esc(l.name)}</div>
          <div style="font-size:14px;color:#6b7280">${esc(l.company || "")}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <span style="background:${tierColor(l.tier)};color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">${tierLabel(l.tier)}</span>
          <span style="background:${urgencyColor(l.urgency)};color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">${l.urgency}</span>
          <span style="background:#e5e7eb;color:#374151;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">${Math.round(l.relevance * 100)}%</span>
        </div>
      </div>
      ${l.headline ? `<div style="font-size:13px;color:#4b5563;margin-bottom:10px;font-style:italic">${esc(l.headline)}</div>` : ""}
      ${l.post_content ? `<div style="background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;color:#374151;line-height:1.5;border:1px solid #e5e7eb"><div style="font-size:11px;font-weight:600;color:#9ca3af;margin-bottom:4px;text-transform:uppercase">${(l.keyword_match || "").startsWith("[SN]") ? "Profile Context" : "Their Post"}</div>${esc(l.post_content)}</div>` : ""}
      ${(l.contact_email || l.contact_info) ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;color:#166534;line-height:1.5;border:1px solid #bbf7d0"><div style="font-size:11px;font-weight:600;color:#22c55e;margin-bottom:4px;text-transform:uppercase">Contact Info</div>${l.contact_email ? `Email: <a href="mailto:${esc(l.contact_email)}" style="color:#2563eb">${esc(l.contact_email)}</a>` : ""}${l.contact_info ? `${l.contact_email ? " | " : ""}${esc(l.contact_info)}` : ""}</div>` : ""}
      ${l.draft_message ? `<div style="background:#eff6ff;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;color:#1e40af;line-height:1.5;border:1px solid #bfdbfe"><div style="font-size:11px;font-weight:600;color:#60a5fa;margin-bottom:4px;text-transform:uppercase">Draft Outreach</div>${esc(l.draft_message)}</div>` : ""}
      <div style="display:flex;gap:16px;font-size:12px;color:#9ca3af">
        ${l.profile_url ? `<a href="${esc(l.profile_url)}" style="color:#2563eb;text-decoration:none">LinkedIn Profile</a>` : ""}
        <span>Found: ${l.found_at ? new Date(l.found_at).toLocaleDateString() : "N/A"}</span>
        ${l.post_date ? `<span>Posted: ${l.post_date}</span>` : ""}
        <span>Status: ${l.status}</span>
      </div>
    </div>`).join("");

  const highCount = leads.filter((l) => l.urgency === "high").length;
  const t1 = leads.filter((l) => l.tier === 1).length;
  const t2 = leads.filter((l) => l.tier === 2).length;
  const t3 = leads.filter((l) => l.tier === 3).length;
  const t4 = leads.filter((l) => l.tier === 4).length;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Lead Report — ${today}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:720px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:28px;font-weight:800;color:#1a1a2e;margin:0 0 4px 0">LinkedIn Lead Report</h1>
      <p style="font-size:14px;color:#6b7280;margin:0">${today}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:28px">
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#1a1a2e">${leads.length}</div><div style="font-size:12px;color:#6b7280;font-weight:500">Total Leads</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#ef4444">${highCount}</div><div style="font-size:12px;color:#6b7280;font-weight:500">High Urgency</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#3b82f6">${t1}</div><div style="font-size:12px;color:#6b7280;font-weight:500">T1 Freelance</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#8b5cf6">${t2 + t3}</div><div style="font-size:12px;color:#6b7280;font-weight:500">T2/T3 Product</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#ec4899">${t4}</div><div style="font-size:12px;color:#6b7280;font-weight:500">T4 Branding</div></div>
    </div>
    ${leadCards}
    <div style="text-align:center;margin-top:32px;padding:16px;font-size:12px;color:#9ca3af">Generated by LinkedIn Lead Gen Pipeline</div>
  </div>
</body></html>`;
}

export async function generateLeadXlsx(leads: Lead[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const tierLabel = (t: number) => t === 1 ? "T1 Freelance" : t === 2 ? "T2 Product" : t === 3 ? "T3 AI Scale" : "T4 Branding";

  const headerColumns = [
    { header: "Name", key: "name", width: 22 },
    { header: "Company", key: "company", width: 20 },
    { header: "Headline", key: "headline", width: 30 },
    { header: "Tier", key: "tier", width: 14 },
    { header: "Relevance", key: "relevance", width: 12 },
    { header: "Urgency", key: "urgency", width: 10 },
    { header: "Status", key: "status", width: 10 },
    { header: "Post Snippet", key: "post", width: 50 },
    { header: "Draft Message", key: "draft", width: 50 },
    { header: "Profile URL", key: "url", width: 35 },
    { header: "Contact Email", key: "email", width: 25 },
    { header: "Contact Info", key: "contact", width: 25 },
    { header: "Post Date", key: "post_date", width: 14 },
  ];

  function buildSheet(name: string, sheetLeads: Lead[]) {
    const ws = workbook.addWorksheet(name);
    const byDate = new Map<string, Lead[]>();
    for (const l of sheetLeads) {
      const dateKey = l.found_at ? l.found_at.split("T")[0] : "Unknown";
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(l);
    }

    let rowNum = 1;
    const dateKeys = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

    for (const dateKey of dateKeys) {
      const dateLeads = byDate.get(dateKey)!;
      const dateRow = ws.getRow(rowNum);
      dateRow.getCell(1).value = formatDateLabel(dateKey);
      dateRow.getCell(1).font = { bold: true, size: 13, color: { argb: "FF4F46E5" } };
      ws.mergeCells(rowNum, 1, rowNum, headerColumns.length);
      rowNum++;

      const headerRow = ws.getRow(rowNum);
      headerColumns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
        cell.alignment = { horizontal: "left" };
      });
      rowNum++;

      headerColumns.forEach((col, i) => {
        const wsCol = ws.getColumn(i + 1);
        if (!wsCol.width || wsCol.width < col.width) wsCol.width = col.width;
      });

      for (const l of dateLeads) {
        const dataRow = ws.getRow(rowNum);
        dataRow.getCell(1).value = l.name;
        dataRow.getCell(2).value = l.company || "";
        dataRow.getCell(3).value = l.headline || "";
        dataRow.getCell(4).value = tierLabel(l.tier);
        dataRow.getCell(5).value = Math.round(l.relevance * 100) + "%";
        dataRow.getCell(6).value = l.urgency;
        dataRow.getCell(7).value = l.status;
        dataRow.getCell(8).value = (l.post_content || "").slice(0, 200);
        dataRow.getCell(9).value = l.draft_message || "";
        dataRow.getCell(10).value = l.profile_url || "";
        dataRow.getCell(11).value = l.contact_email || "";
        dataRow.getCell(12).value = l.contact_info || "";
        dataRow.getCell(13).value = l.post_date || "";
        dataRow.alignment = { wrapText: true, vertical: "top" };
        rowNum++;
      }
      rowNum++;
    }

    if (sheetLeads.length === 0) {
      ws.getRow(1).getCell(1).value = "No leads found";
      ws.getRow(1).getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
    }
  }

  buildSheet("Tech", leads.filter((l) => l.tier <= 3));
  buildSheet("Branding & Packaging", leads.filter((l) => l.tier === 4));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Job Exports ──

export function generateJobCsv(jobs: Job[]): string {
  const csvEsc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
  const header = "Title,Company,Location,Work Mode,Fit Score,Stack Match,Seniority,Urgency,Status,Description,Draft Message,Job URL,Poster,Found";
  const rows = jobs.map((j) =>
    [
      csvEsc(j.title), csvEsc(j.company), csvEsc(j.location), j.work_mode,
      Math.round(j.fit_score * 100) + "%", Math.round(j.stack_match * 100) + "%",
      j.seniority_match, j.urgency, j.status,
      csvEsc(j.job_description), csvEsc(j.draft_message),
      j.job_url, csvEsc(j.poster_name),
      j.found_at ? new Date(j.found_at).toLocaleDateString() : "",
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export function generateJobHtmlReport(jobs: Job[], title: string): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const modeColor = (m: string) => m === "remote" ? "#22c55e" : m === "hybrid" ? "#3b82f6" : m === "onsite" ? "#f97316" : "#6b7280";
  const seniorityColor = (s: string) => s === "exact" ? "#22c55e" : s === "close" ? "#eab308" : "#ef4444";

  const jobCards = jobs.map((j) => `
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid ${modeColor(j.work_mode)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:18px;font-weight:700;color:#1a1a2e">${esc(j.title)}</div>
          <div style="font-size:14px;color:#6b7280">${esc(j.company || "")} ${j.location ? "— " + esc(j.location) : ""}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <span style="background:${modeColor(j.work_mode)};color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">${j.work_mode}</span>
          <span style="background:${seniorityColor(j.seniority_match)};color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">${j.seniority_match}</span>
          <span style="background:#e5e7eb;color:#374151;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">Fit ${Math.round(j.fit_score * 100)}%</span>
        </div>
      </div>
      ${j.salary_range ? `<div style="font-size:13px;color:#22c55e;font-weight:600;margin-bottom:8px">${esc(j.salary_range)}</div>` : ""}
      ${j.job_description ? `<div style="background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;color:#374151;line-height:1.5;border:1px solid #e5e7eb">${esc(j.job_description)}</div>` : ""}
      ${j.draft_message ? `<div style="background:#eff6ff;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;color:#1e40af;line-height:1.5;border:1px solid #bfdbfe"><div style="font-size:11px;font-weight:600;color:#60a5fa;margin-bottom:4px;text-transform:uppercase">Draft Message</div>${esc(j.draft_message)}</div>` : ""}
      <div style="display:flex;gap:16px;font-size:12px;color:#9ca3af">
        ${j.job_url ? `<a href="${esc(j.job_url)}" style="color:#2563eb;text-decoration:none">Job Listing</a>` : ""}
        ${j.poster_url ? `<a href="${esc(j.poster_url)}" style="color:#2563eb;text-decoration:none">Poster Profile</a>` : ""}
        <span>Stack match: ${Math.round(j.stack_match * 100)}%</span>
        <span>Found: ${j.found_at ? new Date(j.found_at).toLocaleDateString() : "N/A"}</span>
      </div>
    </div>`).join("");

  const highFit = jobs.filter((j) => j.fit_score >= 0.7).length;
  const remoteCount = jobs.filter((j) => j.work_mode === "remote").length;
  const exactCount = jobs.filter((j) => j.seniority_match === "exact").length;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} — ${today}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:720px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:28px;font-weight:800;color:#1a1a2e;margin:0 0 4px 0">${title}</h1>
      <p style="font-size:14px;color:#6b7280;margin:0">${today}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#1a1a2e">${jobs.length}</div><div style="font-size:12px;color:#6b7280;font-weight:500">Total Jobs</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#22c55e">${highFit}</div><div style="font-size:12px;color:#6b7280;font-weight:500">High Fit (70%+)</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#3b82f6">${remoteCount}</div><div style="font-size:12px;color:#6b7280;font-weight:500">Remote</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><div style="font-size:28px;font-weight:800;color:#8b5cf6">${exactCount}</div><div style="font-size:12px;color:#6b7280;font-weight:500">Exact Seniority</div></div>
    </div>
    ${jobCards}
    <div style="text-align:center;margin-top:32px;padding:16px;font-size:12px;color:#9ca3af">Generated by Job Search Pipeline</div>
  </div>
</body></html>`;
}
