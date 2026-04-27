import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PMS — Property Management System",
  description: "Manage properties, tenants, leases, and maintenance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
