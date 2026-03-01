import type { Metadata } from "next";
import "./globals.css";
import AuthLayout from "@/components/AuthLayout";

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
        <AuthLayout>{children}</AuthLayout>
      </body>
    </html>
  );
}
