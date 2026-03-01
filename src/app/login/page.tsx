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

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border rounded-xl p-8">
          <h1 className="text-xl font-semibold text-center mb-1">
            <span className="text-accent-light">LinkedIn</span> Lead Gen
          </h1>
          <p className="text-text-muted text-center text-sm mb-6">Sign in to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wide block mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:border-accent"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="text-xs text-text-muted uppercase tracking-wide block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:border-accent"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="text-red text-sm text-center py-1">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
