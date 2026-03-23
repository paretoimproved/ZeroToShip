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

  // State 2a: Free user (limit is 0) — Pro feature teaser
  if (specUsage && specUsage.limit === 0) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-primary-50 to-violet-50 dark:from-primary-950/40 dark:to-violet-950/40 border border-primary-200 dark:border-primary-800 p-5">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
          Agent Specs are a Pro Feature
        </h4>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 mb-4">
          <li className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            User stories with acceptance criteria
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Database schema with relations
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            API routes and endpoints
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            CLAUDE.md agent instructions
          </li>
        </ul>
        <Link
          href="/signup?plan=pro"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  // State 2b: Quota exhausted — tier-aware messaging
  if (specUsage && specUsage.used >= specUsage.limit) {
    const isFree = specUsage.limit < 30;
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            You&apos;ve used {isFree ? "your free" : `all ${specUsage.limit}`} spec generation{specUsage.limit > 1 ? "s" : ""} this month
          </p>
          {isFree ? (
            <div className="mt-3">
              <Link
                href="/signup?plan=pro"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                Get 30 specs/month with Pro
              </Link>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Resets next month. Specs include user stories, DB schemas, API routes, and CLAUDE.md instructions.
            </p>
          )}
        </div>
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
