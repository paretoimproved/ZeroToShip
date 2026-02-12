import type { Metadata } from "next";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

interface IdeaMetadata {
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: string;
}

async function fetchIdea(id: string): Promise<IdeaMetadata | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/ideas/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: { idea: IdeaMetadata } = await res.json();
    return data.idea ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const idea = await fetchIdea(id);

  if (!idea) {
    return {
      title: "Idea Not Found - ZeroToShip",
      description: "This startup idea could not be found.",
    };
  }

  const title = `${idea.name} - ZeroToShip`;
  const description =
    idea.tagline ||
    `Startup idea: ${idea.name}. Scored ${idea.priorityScore}/100.`;

  return {
    title,
    description,
    openGraph: {
      title: `${idea.name} — Startup Idea Brief`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${idea.name} — Startup Idea Brief`,
      description,
    },
  };
}

export default function IdeaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
