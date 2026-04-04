"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import AgentSpecDisplay, { formatSpecAsMarkdown } from "@/components/AgentSpecDisplay";
import GenerateSpecCta from "@/components/GenerateSpecCta";
import { trackIdeaViewed } from "@/lib/analytics";
import type { AgentSpec } from "@/lib/types";

interface IdeaSpecSectionProps {
  ideaId: string;
  ideaName: string;
}

export default function IdeaSpecSection({ ideaId, ideaName }: IdeaSpecSectionProps) {
  const { isAuthenticated, user } = useAuth();
  const [spec, setSpec] = useState<AgentSpec | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [specUsage, setSpecUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    trackIdeaViewed({
      ideaId,
      source: "detail_page",
    });
  }, [ideaId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getSpecUsage().then(setSpecUsage).catch(() => {});
  }, [isAuthenticated]);

  function copySpecToClipboard() {
    if (!spec) return;
    const markdown = formatSpecAsMarkdown(spec);
    navigator.clipboard.writeText(markdown);
  }

  return (
    <>
      <GenerateSpecCta
        ideaId={ideaId}
        ideaName={ideaName}
        isAuthenticated={isAuthenticated}
        userTier={user?.tier}
        specUsage={specUsage ?? undefined}
        onSpecGenerated={(newSpec, id) => {
          setSpec(newSpec);
          setGenerationId(id);
          setSpecUsage((prev) => prev ? { ...prev, used: prev.used + 1 } : prev);
        }}
      />

      {spec && (
        <div className="mt-8">
          <AgentSpecDisplay spec={spec} onCopy={copySpecToClipboard} />
          {generationId && (
            <div className="mt-4 text-center">
              <Link
                href={`/specs/${generationId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                View in My Specs
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}

      {isAuthenticated && (
        <div className="mt-4 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            </svg>
            View in Dashboard
          </Link>
        </div>
      )}
    </>
  );
}
