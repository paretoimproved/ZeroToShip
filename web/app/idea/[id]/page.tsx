import Link from "next/link";
import { notFound } from "next/navigation";
import LandingNav from "@/components/landing/LandingNav";
import Footer from "@/components/landing/Footer";
import IdeaBriefCard from "@/components/IdeaBriefCard";
import IdeaSpecSection from "@/components/IdeaSpecSection";
import type { IdeaBrief } from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

async function fetchIdea(id: string): Promise<IdeaBrief | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/ideas/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: { idea: IdeaBrief } = await res.json();
    return data.idea ?? null;
  } catch {
    return null;
  }
}

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await fetchIdea(id);

  if (!brief) {
    notFound();
  }

  return (
    <>
      <LandingNav />
      <main id="main-content" className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pt-28">
        <h1 className="sr-only">{brief.name}</h1>

        <Link
          href="/explore"
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 mb-6 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Explore
        </Link>

        <IdeaBriefCard
          brief={brief}
          gated={false}
          specCta={
            <IdeaSpecSection ideaId={brief.id} ideaName={brief.name} />
          }
        />
      </main>
      <Footer />
    </>
  );
}
