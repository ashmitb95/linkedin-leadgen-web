"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserRole } from "@/lib/auth";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState("");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )auth_user=([^;]*)/);
    if (match) setUser(decodeURIComponent(match[1]));
  }, []);

  const role = user ? getUserRole(user) : null;
  const links = role?.pages || [];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="navbar">
      <div className="navbar-links no-scrollbar">
        {links.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={isActive ? "nav-link nav-link-active" : "nav-link"}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {user && (
          <span className="nav-user-chip">
            {user}
          </span>
        )}
        <button onClick={handleLogout} className="nav-logout">
          Logout
        </button>
      </div>
    </nav>
  );
}
