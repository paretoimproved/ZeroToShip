"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import type { SpecListItem } from "@/lib/types";

export default function SpecsPage() {
  const [specs, setSpecs] = useState<SpecListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    async function fetchSpecs() {
      if (!isAuthenticated) return;
      try {
        const data = await api.getSpecs();
        setSpecs(data.specs);
      } catch (error) {
        console.log("Failed to load specs:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSpecs();
  }, [isAuthenticated]);

  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          My Specs
        </h1>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 animate-pulse"
              >
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : specs.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No specs generated yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Generate your first spec from any idea page.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              Browse Ideas
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specs.map((spec) => (
              <Link
                key={spec.id}
                href={`/specs/${spec.id}`}
                className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(38,28,10,0.14)]"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {spec.projectName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  from {spec.ideaName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {new Date(spec.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
