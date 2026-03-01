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
    <nav className="flex items-center justify-between mb-4">
      <div className="flex gap-4">
        {links.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`text-[13px] no-underline pb-1 border-b-2 ${
                isActive
                  ? "text-accent-light border-accent-light"
                  : "text-text-muted border-transparent hover:text-text"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-xs text-text-muted">{user}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-xs text-text-muted hover:text-text cursor-pointer"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
