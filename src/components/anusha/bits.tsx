"use client";

import { useState } from "react";

const AVATAR_COLORS = ["#6366f1", "#22c55e", "#a855f7", "#f97316", "#0ea5e9", "#e11d48", "#14b8a6", "#ca8a04"];

function domainOf(website: string): string {
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function CompanyLogo({ name, website, large }: { name: string; website: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const domain = domainOf(website);
  return (
    <div className={large ? "ac-logo ac-logo-lg" : "ac-logo"}>
      {domain && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="ac-logo-fallback">{name.charAt(0)}</span>
      )}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const parts = name.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <div className="ac-avatar" style={{ background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}>
      {initials || "?"}
    </div>
  );
}

export function shortDate(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
}
