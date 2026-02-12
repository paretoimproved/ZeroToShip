import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Idea Archive - ZeroToShip",
  description:
    "Browse hundreds of AI-scored startup ideas from Reddit, Hacker News, and GitHub. Filter by effort, score, and source.",
};

export default function ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
