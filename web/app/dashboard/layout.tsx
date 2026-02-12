import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - ZeroToShip",
  description:
    "View today's top-scored startup ideas with full business briefs.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
