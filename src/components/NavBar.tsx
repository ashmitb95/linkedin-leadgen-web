"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Leads" },
  { href: "/jobs", label: "Job Search" },
  { href: "/anusha", label: "Anusha's Jobs" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 mb-4">
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
    </nav>
  );
}
