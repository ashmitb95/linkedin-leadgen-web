/**
 * Role-based access: which pages and API routes each user can access.
 *
 * pages   — front-end routes shown in NavBar
 * api     — API path prefixes the user is allowed to call
 * default — where to redirect after login
 */

export interface UserRole {
  pages: { href: string; label: string }[];
  api: string[];
  default: string;
}

const roles: Record<string, UserRole> = {
  ashmit: {
    pages: [
      { href: "/", label: "Leads" },
      { href: "/jobs", label: "Job Search" },
      { href: "/anusha", label: "Anusha's Jobs" },
      { href: "/sourav", label: "Sourav's Jobs" },
    ],
    api: ["/api/"],
    default: "/",
  },
  anusha: {
    pages: [
      { href: "/anusha", label: "My Jobs" },
    ],
    api: ["/api/anusha-job", "/api/auth/"],
    default: "/anusha",
  },
  sourav: {
    pages: [
      { href: "/sourav", label: "My Jobs" },
    ],
    api: ["/api/sourav-job", "/api/auth/"],
    default: "/sourav",
  },
  siddhartha: {
    pages: [
      { href: "/", label: "Leads" },
    ],
    api: ["/api/leads", "/api/stats", "/api/digest", "/api/export/", "/api/runs", "/api/auth/"],
    default: "/",
  },
};

export function getUserRole(username: string): UserRole | null {
  return roles[username.toLowerCase()] || null;
}

export function canAccessPage(username: string, pathname: string): boolean {
  const role = getUserRole(username);
  if (!role) return false;
  return role.pages.some((p) => p.href === pathname);
}

export function canAccessApi(username: string, pathname: string): boolean {
  const role = getUserRole(username);
  if (!role) return false;
  return role.api.some((prefix) => pathname.startsWith(prefix));
}
