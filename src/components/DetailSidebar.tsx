"use client";

import { useEffect } from "react";

interface DetailSidebarProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function DetailSidebar({ open, onClose, children }: DetailSidebarProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`sidebar-overlay ${open ? "open" : ""}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`sidebar-panel ${open ? "open" : ""}`}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "#a1a1aa",
            fontSize: 24,
            cursor: "pointer",
            padding: 4,
            lineHeight: 1,
            fontFamily: "inherit",
            zIndex: 1,
          }}
        >
          &times;
        </button>

        {/* Content */}
        <div style={{ padding: "24px", overflowY: "auto", height: "100%" }}>
          {children}
        </div>
      </div>
    </>
  );
}
