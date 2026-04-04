/** @deprecated Use IdeaBriefCard instead */
import Link from "next/link";
import type { IdeaBrief } from "@/lib/types";
import { ScoreBadge, EffortBadge } from "./ScoreBadge";

interface IdeaCardProps {
  idea: IdeaBrief;
  rank?: number;
  index?: number;
}

export default function IdeaCard({ idea, rank, index }: IdeaCardProps) {
  return (
    <Link
      href={`/idea/${idea.id}`}
      className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 rounded-xl"
    >
      <article
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer animate-fade-in-up opacity-0"
        style={{ animationDelay: `${(index ?? 0) * 150}ms` }}
      >
        <div className="flex items-start gap-4">
          {rank !== undefined && (
            <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                {rank}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {idea.name}
              </h2>
              <ScoreBadge score={idea.priorityScore} />
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">
              {idea.tagline}
            </p>

            <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 line-clamp-2">
              {idea.problemStatement}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <EffortBadge effort={idea.effortEstimate} size="sm" />
            </div>
          </div>

          <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </article>
    </Link>
  );
}
