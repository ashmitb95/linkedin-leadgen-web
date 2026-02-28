import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "LinkedIn Lead Gen Dashboard",
  description: "Lead generation and job search dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-[1400px] mx-auto p-6">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}
