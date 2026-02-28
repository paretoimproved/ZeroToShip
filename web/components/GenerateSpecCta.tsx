"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import type { AgentSpec } from "@/lib/types";

interface GenerateSpecCtaProps {
  ideaId: string;
  ideaName: string;
  isAuthenticated: boolean;
  userTier?: string;
  specUsage?: { used: number; limit: number };
  onSpecGenerated?: (spec: AgentSpec, generationId: string) => void;
}

export default function GenerateSpecCta({
  ideaId,
  ideaName,
  isAuthenticated,
  specUsage,
  onSpecGenerated,
}: GenerateSpecCtaProps) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // State 1: Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Generate a developer-ready spec with user stories, DB schema, API routes, and CLAUDE.md instructions.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Sign up to generate specs
        </Link>
      </div>
    );
  }

  // State 2: Quota exhausted
  if (specUsage && specUsage.used >= specUsage.limit) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            You&apos;ve used all {specUsage.limit} spec generations this month
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Specs include user stories, DB schemas, API routes, and CLAUDE.md instructions — everything you need to start building.
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  // State 3: Quota available — generate button
  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await api.generateSpec(ideaId);
      const generationId = result.generationId;
      toast.push({
        variant: "success",
        title: "Spec generated!",
        description: (
          <Link
            href={`/specs/${generationId}`}
            className="underline text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200"
          >
            View spec for {ideaName}
          </Link>
        ),
        durationMs: 8000,
      });
      onSpecGenerated?.(result.spec, generationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate spec";
      toast.error("Spec generation failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Generate Agent Spec
          </>
        )}
      </button>
      {specUsage && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {specUsage.limit - specUsage.used} of {specUsage.limit} remaining this month
        </span>
      )}
    </div>
  );
}
