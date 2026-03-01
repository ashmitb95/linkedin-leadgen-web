import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthLayout from "@/components/AuthLayout";

export const metadata: Metadata = {
  title: "LinkedIn Lead Gen Dashboard",
  description: "Lead generation and job search dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthLayout>{children}</AuthLayout>
      </body>
    </html>
  );
}
