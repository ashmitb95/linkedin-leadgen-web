"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type ICellEditorParams,
  type CellValueChangedEvent,
  type ColumnResizedEvent,
} from "ag-grid-community";
import type { Lead } from "@/lib/schema";

ModuleRegistry.registerModules([AllCommunityModule]);

// ── Theme ──
const darkTheme = themeQuartz.withParams({
  backgroundColor: "#09090b",
  foregroundColor: "#fafafa",
  headerBackgroundColor: "#18181b",
  headerTextColor: "#a1a1aa",
  headerFontWeight: 600,
  headerFontSize: "11px",
  borderColor: "#3f3f46",
  rowHoverColor: "#1a1a1f",
  selectedRowBackgroundColor: "rgba(99, 102, 241, 0.12)",
  accentColor: "#6366f1",
  fontFamily: "'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: "13px",
  cellHorizontalPadding: "16px",
  rowBorder: { color: "#1f1f23", width: 1, style: "solid" },
  columnBorder: false,
  wrapperBorder: false,
  headerColumnBorder: false,
  oddRowBackgroundColor: "#0c0c0f",
  wrapperBorderRadius: "0px",
  spacing: "8px",
});

// ── Status / urgency options ──
const STATUS_OPTIONS = [
  { value: "new", label: "Needs Triage" },
  { value: "message_sent", label: "Message Sent" },
  { value: "reply_received", label: "Reply Received" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "client_converted", label: "Converted" },
  { value: "client_churned", label: "Churned" },
  { value: "invalid", label: "Invalid" },
];

const URGENCY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// ── Cell renderers ──

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 7px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  lineHeight: "16px",
  whiteSpace: "nowrap",
};

function NameCellRenderer(params: ICellRendererParams) {
  return (
    <div style={{ lineHeight: 1.4, padding: "6px 0" }}>
      <div style={{ fontWeight: 600, color: "#fafafa", fontSize: 13 }}>{params.value}</div>
      {params.data.company && (
        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{params.data.company}</div>
      )}
    </div>
  );
}

const statusColors: Record<string, { bg: string; fg: string }> = {
  new: { bg: "#1e3a5f", fg: "#60a5fa" },
  message_sent: { bg: "#422006", fg: "#fbbf24" },
  reply_received: { bg: "#14532d", fg: "#4ade80" },
  meeting_booked: { bg: "#312e81", fg: "#a78bfa" },
  client_converted: { bg: "#14532d", fg: "#22c55e" },
  client_churned: { bg: "#450a0a", fg: "#f87171" },
  invalid: { bg: "#27272a", fg: "#71717a" },
};

function StatusCellRenderer(params: ICellRendererParams) {
  const label = STATUS_OPTIONS.find((o) => o.value === params.value)?.label || params.value;
  const colors = statusColors[params.value] || { bg: "#27272a", fg: "#a1a1aa" };
  return (
    <span style={{ ...pillStyle, background: colors.bg, color: colors.fg, cursor: "pointer" }}>
      {label}
    </span>
  );
}

const urgencyColors: Record<string, { bg: string; fg: string }> = {
  high: { bg: "#450a0a", fg: "#f87171" },
  medium: { bg: "#422006", fg: "#fbbf24" },
  low: { bg: "#27272a", fg: "#a1a1aa" },
};

function UrgencyCellRenderer(params: ICellRendererParams) {
  const colors = urgencyColors[params.value] || { bg: "#27272a", fg: "#a1a1aa" };
  return <span style={{ ...pillStyle, background: colors.bg, color: colors.fg }}>{params.value}</span>;
}

const tierLabels: Record<number, string> = {
  1: "T1 Freelance",
  2: "T2 Product",
  3: "T3 AI Scale",
  4: "T4 Branding",
};
const tierColors: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#1e3a5f", fg: "#60a5fa" },
  2: { bg: "#312e81", fg: "#a78bfa" },
  3: { bg: "#14532d", fg: "#4ade80" },
  4: { bg: "#4a1942", fg: "#f472b6" },
};

function TierCellRenderer(params: ICellRendererParams) {
  const colors = tierColors[params.value] || { bg: "#27272a", fg: "#a1a1aa" };
  return (
    <span style={{ ...pillStyle, background: colors.bg, color: colors.fg }}>
      {tierLabels[params.value] || `T${params.value}`}
    </span>
  );
}

function SourceCellRenderer(params: ICellRendererParams) {
  const isSN = params.value === "Sales Navigator";
  return (
    <span
      style={{
        ...pillStyle,
        background: isSN ? "#1e3a5f" : "#2e1065",
        color: isSN ? "#60a5fa" : "#c084fc",
      }}
    >
      {isSN ? "Sales Nav" : "Content"}
    </span>
  );
}

function RelevanceCellRenderer(params: ICellRendererParams) {
  const pct = Math.round((params.value || 0) * 100);
  const colorClass = pct >= 70 ? "high" : pct >= 40 ? "medium" : "low";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#a1a1aa", minWidth: 32 }}>{pct}%</span>
      <span className="fit-bar" style={{ width: 60 }}>
        <span className={`fit-bar-fill ${colorClass}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function LinkCellRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  const url = params.value.startsWith("http")
    ? params.value
    : `https://www.linkedin.com${params.value}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ color: "#818cf8", fontSize: 12, fontWeight: 500, textDecoration: "none" }}
    >
      View &rarr;
    </a>
  );
}

// ── Custom select cell editor (shows labels, stores values) ──

interface SelectEditorOption {
  value: string;
  label: string;
}

interface SelectEditorProps extends ICellEditorParams {
  options: SelectEditorOption[];
}

const SelectCellEditor = forwardRef(function SelectCellEditor(
  props: SelectEditorProps,
  ref: React.Ref<unknown>
) {
  const valueRef = useRef(props.value);
  const selectRef = useRef<HTMLSelectElement>(null);

  useImperativeHandle(ref, () => ({
    getValue() {
      return valueRef.current;
    },
    isCancelAfterEnd() {
      return false;
    },
    afterGuiAttached() {
      selectRef.current?.focus();
    },
  }));

  return (
    <select
      ref={selectRef}
      defaultValue={props.value}
      onChange={(e) => {
        valueRef.current = e.target.value;
        props.stopEditing();
      }}
      style={{
        width: "100%",
        height: "100%",
        background: "#18181b",
        color: "#fafafa",
        border: "1px solid #6366f1",
        borderRadius: 4,
        padding: "0 8px",
        fontSize: 12,
        fontFamily: "inherit",
        outline: "none",
        cursor: "pointer",
      }}
    >
      {props.options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});

// ── Column width persistence ──

const COL_WIDTH_KEY = "leadgen_colWidths";

function loadColumnWidths(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COL_WIDTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveColumnWidths(widths: Record<string, number>) {
  try {
    localStorage.setItem(COL_WIDTH_KEY, JSON.stringify(widths));
  } catch {}
}

// ── Column definitions ──

function buildColumnDefs(narrow: boolean): ColDef[] {
  return [
    {
      field: "name",
      headerName: "Name",
      width: 200,
      minWidth: 130,
      pinned: narrow ? undefined : "left",
      cellRenderer: NameCellRenderer,
      sortable: true,
      filter: true,
    },
    {
      field: "company",
      headerName: "Company",
      width: 160,
      minWidth: 100,
      flex: narrow ? undefined : 1,
      sortable: true,
      filter: true,
    },
    {
      field: "status",
      headerName: "Status",
      width: 170,
      minWidth: 130,
      editable: true,
      cellEditor: SelectCellEditor,
      cellEditorParams: { options: STATUS_OPTIONS },
      cellRenderer: StatusCellRenderer,
    },
    {
      field: "urgency",
      headerName: "Urgency",
      width: 130,
      minWidth: 100,
      editable: true,
      cellEditor: SelectCellEditor,
      cellEditorParams: { options: URGENCY_OPTIONS },
      cellRenderer: UrgencyCellRenderer,
    },
    {
      field: "tier",
      headerName: "Tier",
      width: 140,
      minWidth: 100,
      cellRenderer: TierCellRenderer,
      sortable: true,
    },
    {
      headerName: "Source",
      width: 140,
      minWidth: 100,
      valueGetter: (params) =>
        params.data?.keyword_match?.startsWith("[SN]") ? "Sales Navigator" : "Content",
      cellRenderer: SourceCellRenderer,
    },
    {
      field: "relevance",
      headerName: "Relevance",
      width: 140,
      minWidth: 110,
      cellRenderer: RelevanceCellRenderer,
      sortable: true,
      comparator: (a: number, b: number) => a - b,
    },
    {
      field: "headline",
      headerName: "Headline",
      width: 280,
      minWidth: 150,
      flex: narrow ? undefined : 2,
      tooltipField: "headline",
    },
    {
      field: "post_content",
      headerName: "Post Content",
      width: 300,
      minWidth: 150,
      flex: narrow ? undefined : 2,
      tooltipField: "post_content",
      valueFormatter: (params) => {
        if (!params.value) return "";
        return params.value.length > 100 ? params.value.slice(0, 100) + "…" : params.value;
      },
    },
    {
      field: "contact_email",
      headerName: "Email",
      width: 200,
      minWidth: 120,
      editable: true,
      cellEditor: "agTextCellEditor",
    },
    {
      field: "contact_info",
      headerName: "Contact Info",
      width: 180,
      minWidth: 120,
      editable: true,
      cellEditor: "agTextCellEditor",
    },
    {
      field: "profile_url",
      headerName: "Profile",
      width: 90,
      minWidth: 70,
      pinned: narrow ? undefined : "right",
      cellRenderer: LinkCellRenderer,
    },
    {
      field: "post_url",
      headerName: "Post",
      width: 90,
      minWidth: 70,
      cellRenderer: LinkCellRenderer,
    },
    {
      field: "found_at",
      headerName: "Found",
      width: 120,
      minWidth: 90,
      valueFormatter: (params) => {
        if (!params.value) return "";
        return new Date(params.value).toLocaleDateString();
      },
      sortable: true,
    },
    {
      field: "post_date",
      headerName: "Posted",
      width: 120,
      minWidth: 90,
      sortable: true,
    },
    {
      field: "keyword_match",
      headerName: "Keyword",
      width: 200,
      minWidth: 120,
      tooltipField: "keyword_match",
      filter: true,
    },
  ];
}

// ── Main component ──

interface LeadTableProps {
  leads: Lead[];
  loading: boolean;
  onSelectLead: (lead: Lead) => void;
  onLeadUpdated: () => void;
}

export default function LeadTable({ leads, loading, onSelectLead, onLeadUpdated }: LeadTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const savedWidths = useRef(loadColumnWidths());

  const columnDefs = useMemo<ColDef[]>(() => {
    const widths = savedWidths.current;
    const cols = baseColumnDefs.map((col) => {
      const key = col.field || col.headerName || "";
      if (key && widths[key]) {
        return { ...col, width: widths[key] };
      }
      return col;
    });
    return [
      ...cols,
      {
        headerName: "",
        width: 70,
        pinned: "right",
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: ICellRendererParams) => (
          <button
            onClick={() => onSelectLead(params.data)}
            style={{
              background: "rgba(99, 102, 241, 0.1)",
              border: "none",
              borderRadius: 6,
              color: "#818cf8",
              fontSize: 12,
              fontWeight: 500,
              padding: "5px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.01em",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(99, 102, 241, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
            }}
          >
            Details
          </button>
        ),
      },
    ];
  }, [onSelectLead]);

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: false,
      filter: false,
      suppressMovable: false,
    }),
    []
  );

  const onColumnResized = useCallback((event: ColumnResizedEvent) => {
    if (event.finished && event.column) {
      const key = event.column.getColDef().field || event.column.getColDef().headerName || "";
      if (key) {
        const current = loadColumnWidths();
        current[key] = event.column.getActualWidth();
        saveColumnWidths(current);
      }
    }
  }, []);

  const onCellValueChanged = useCallback(
    async (event: CellValueChangedEvent) => {
      const { data, colDef, newValue, oldValue } = event;
      if (newValue === oldValue) return;

      const field = colDef.field;
      if (!field) return;

      try {
        const res = await fetch(`/api/leads/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: newValue }),
        });
        if (!res.ok) {
          event.node.setDataValue(field, oldValue);
        } else {
          onLeadUpdated();
        }
      } catch {
        event.node.setDataValue(field, oldValue);
      }
    },
    [onLeadUpdated]
  );

  return (
    <div style={{ width: "100%", height: "calc(100vh - 300px)", minHeight: 400 }}>
      <AgGridReact
        ref={gridRef}
        theme={darkTheme}
        rowData={leads}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowHeight={52}
        headerHeight={44}
        onCellValueChanged={onCellValueChanged}
        onColumnResized={onColumnResized}
        getRowId={(params) => params.data.id}
        animateRows={true}
        loading={loading}
        tooltipShowDelay={500}
        stopEditingWhenCellsLoseFocus={true}
        singleClickEdit={true}
      />
    </div>
  );
}
