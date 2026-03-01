"use client";

import { usePathname } from "next/navigation";
import NavBar from "@/components/NavBar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <NavBar />
      {children}
    </div>
  );
}
