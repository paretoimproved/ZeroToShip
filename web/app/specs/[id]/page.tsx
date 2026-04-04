"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AgentSpecDisplay, { formatSpecAsMarkdown } from "@/components/AgentSpecDisplay";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import type { SpecDetail } from "@/lib/types";

export default function SpecViewerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [specDetail, setSpecDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    async function fetchSpec() {
      if (!isAuthenticated) return;
      try {
        const data = await api.getSpec(id);
        setSpecDetail(data);
      } catch (error) {
        console.log("Failed to load spec:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchSpec();
  }, [id, isAuthenticated]);

  function copySpecToClipboard() {
    if (!specDetail) return;
    const markdown = formatSpecAsMarkdown(specDetail.spec);
    navigator.clipboard.writeText(markdown);
  }

  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {loading ? (
          <>
            {/* Breadcrumb skeleton */}
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6 animate-pulse" />

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-pulse">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </div>
              <div className="p-6 space-y-4">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
              </div>
            </div>
          </>
        ) : notFound ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Spec not found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This spec may have been deleted or you don&apos;t have access to it.
            </p>
            <Link
              href="/specs"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              Back to My Specs
            </Link>
          </div>
        ) : specDetail ? (
          <>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <Link
                href="/specs"
                className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                My Specs
              </Link>
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="text-gray-900 dark:text-white font-medium">
                {specDetail.projectName}
              </span>
            </nav>

            <AgentSpecDisplay
              spec={specDetail.spec}
              onCopy={copySpecToClipboard}
            />
          </>
        ) : null}
      </div>
    </ProtectedLayout>
  );
}
