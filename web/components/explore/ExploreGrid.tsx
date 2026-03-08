"use client";

import { useState } from "react";
import IdeaBriefCard from "@/components/IdeaBriefCard";
import type { IdeaBrief, EffortLevel } from "@/lib/types";

interface ExploreIdea {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: EffortLevel;
  revenueEstimate: string;
  generatedAt?: string;
  brief?: IdeaBrief;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-gray-400";
}

function getEffortLabel(effort: EffortLevel): string {
  const labels: Record<EffortLevel, string> = {
    weekend: "Weekend",
    week: "1 Week",
    month: "1 Month",
    quarter: "Quarter+",
  };
  return labels[effort] || effort;
}

function getEffortBadgeColor(effort: EffortLevel): string {
  const colors: Record<EffortLevel, string> = {
    weekend:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    week: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    month: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    quarter: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return (
    colors[effort] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
  );
}

export default function ExploreGrid({ ideas }: { ideas: ExploreIdea[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (ideas.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No ideas available right now. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {ideas.map((idea) => {
        const isExpanded = expandedId === idea.id;

        return (
          <article
            key={idea.id}
            className={isExpanded ? "sm:col-span-2 lg:col-span-3" : ""}
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : idea.id)}
              className={`w-full text-left bg-white dark:bg-gray-900 rounded-xl border p-5 transition-all duration-200 ${
                isExpanded
                  ? "border-primary-400 dark:border-primary-500 shadow-xl"
                  : "border-gray-200 dark:border-gray-700 hover:-translate-y-1 hover:shadow-xl hover:border-primary-400 dark:hover:border-primary-500"
              }`}
            >
              {/* Score + Name */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getScoreColor(idea.priorityScore)}`}
                >
                  {Math.round(idea.priorityScore)}
                </div>
                <h2 className="font-mono text-sm font-bold text-gray-900 dark:text-white truncate flex-1">
                  {idea.name}
                </h2>
                <svg
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {/* Tagline */}
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                {idea.tagline}
              </p>

              {/* Effort */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${getEffortBadgeColor(idea.effortEstimate)}`}
                >
                  {getEffortLabel(idea.effortEstimate)}
                </span>
              </div>
            </button>

            {/* Expanded brief */}
            {isExpanded && idea.brief && (
              <div className="mt-3">
                <IdeaBriefCard brief={idea.brief} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
