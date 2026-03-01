"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(data.redirect || "/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    background: "#09090b",
    border: "1px solid #3f3f46",
    borderRadius: 12,
    color: "#fafafa",
    fontSize: 14,
    fontFamily: "inherit",
    transition: "all 0.2s ease",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b", padding: "0 16px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 20, padding: 40, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 4, letterSpacing: "-0.02em" }}>
            <span style={{ color: "#818cf8" }}>LinkedIn</span> Lead Gen
          </h1>
          <p style={{ color: "#a1a1aa", textAlign: "center", fontSize: 14, marginBottom: 32 }}>
            Sign in to continue
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, display: "block", marginBottom: 8 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
                style={inputStyle}
                placeholder="Enter username"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#6366f1";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.2)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#3f3f46";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, display: "block", marginBottom: 8 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
                placeholder="Enter password"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#6366f1";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.2)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#3f3f46";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <div style={{ color: "#ef4444", fontSize: 14, textAlign: "center", padding: "4px 0" }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 0",
                background: loading ? "#4f46e5" : "#6366f1",
                color: "#fff",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: loading ? "not-allowed" : "pointer",
                border: "none",
                opacity: loading ? 0.6 : 1,
                transition: "all 0.2s ease",
                marginTop: 4,
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
