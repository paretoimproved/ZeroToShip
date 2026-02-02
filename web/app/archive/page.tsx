"use client";

import { useState } from "react";
import IdeaCard from "@/components/IdeaCard";
import type { IdeaBrief, EffortLevel } from "@/lib/types";

// Mock archive data
const mockArchive: IdeaBrief[] = [
  {
    id: "arch-1",
    name: "API Playground",
    tagline: "Test any API without writing code",
    priorityScore: 82,
    effortEstimate: "week",
    revenueEstimate: "$8K-20K MRR",
    problemStatement: "Developers waste time writing test scripts to explore APIs.",
    targetAudience: "Backend developers",
    marketSize: "$1B API tools market",
    existingSolutions: "Postman, Insomnia",
    gaps: "Complex UI, steep learning curve",
    proposedSolution: "Visual API explorer",
    keyFeatures: ["Visual request builder", "Auto-documentation", "Team sharing"],
    mvpScope: "REST APIs only",
    technicalSpec: {
      stack: ["React", "Electron"],
      architecture: "Desktop app",
      estimatedEffort: "1 week",
    },
    businessModel: {
      pricing: "$12/mo",
      revenueProjection: "$15K MRR",
      monetizationPath: "Freemium",
    },
    goToMarket: {
      launchStrategy: "Developer communities",
      channels: ["GitHub", "Dev.to"],
      firstCustomers: "Open source contributors",
    },
    risks: ["Postman dominance"],
    generatedAt: "2025-01-29T08:00:00Z",
  },
  {
    id: "arch-2",
    name: "MeetingLess",
    tagline: "Async video updates for remote teams",
    priorityScore: 75,
    effortEstimate: "month",
    revenueEstimate: "$10K-30K MRR",
    problemStatement: "Remote teams have too many synchronous meetings.",
    targetAudience: "Remote-first companies",
    marketSize: "$5B remote work tools",
    existingSolutions: "Loom, Zoom",
    gaps: "Not designed for team updates",
    proposedSolution: "Async standup videos with AI summaries",
    keyFeatures: ["Quick recording", "AI summaries", "Thread discussions"],
    mvpScope: "Recording and playback",
    technicalSpec: {
      stack: ["Next.js", "AWS"],
      architecture: "Cloud-native",
      estimatedEffort: "1 month",
    },
    businessModel: {
      pricing: "$8/user/mo",
      revenueProjection: "$25K MRR",
      monetizationPath: "Team plans",
    },
    goToMarket: {
      launchStrategy: "Remote work communities",
      channels: ["Twitter", "LinkedIn"],
      firstCustomers: "Startup founders",
    },
    risks: ["Zoom competition", "Enterprise sales cycle"],
    generatedAt: "2025-01-28T08:00:00Z",
  },
  {
    id: "arch-3",
    name: "BugBuddy",
    tagline: "AI pair programmer for debugging",
    priorityScore: 68,
    effortEstimate: "quarter",
    revenueEstimate: "$20K-50K MRR",
    problemStatement: "Debugging takes 50% of developer time.",
    targetAudience: "Software developers",
    marketSize: "$3B developer productivity",
    existingSolutions: "GitHub Copilot, ChatGPT",
    gaps: "Not specialized for debugging",
    proposedSolution: "IDE extension focused on debugging",
    keyFeatures: ["Error analysis", "Fix suggestions", "Code context"],
    mvpScope: "VS Code extension",
    technicalSpec: {
      stack: ["TypeScript", "OpenAI API"],
      architecture: "IDE extension + cloud API",
      estimatedEffort: "3 months",
    },
    businessModel: {
      pricing: "$19/mo",
      revenueProjection: "$40K MRR",
      monetizationPath: "Individual subscriptions",
    },
    goToMarket: {
      launchStrategy: "VS Code marketplace",
      channels: ["Reddit", "Hacker News"],
      firstCustomers: "Early adopters on Twitter",
    },
    risks: ["AI model costs", "GitHub Copilot improvements"],
    generatedAt: "2025-01-27T08:00:00Z",
  },
];

const effortOptions: { value: EffortLevel | "all"; label: string }[] = [
  { value: "all", label: "All Efforts" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "1 Week" },
  { value: "month", label: "1 Month" },
  { value: "quarter", label: "Quarter+" },
];

export default function ArchivePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [effortFilter, setEffortFilter] = useState<EffortLevel | "all">("all");
  const [minScore, setMinScore] = useState(0);

  // In production: fetch from API with filters
  const filteredIdeas = mockArchive.filter((idea) => {
    const matchesSearch =
      searchQuery === "" ||
      idea.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.problemStatement.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEffort =
      effortFilter === "all" || idea.effortEstimate === effortFilter;

    const matchesScore = idea.priorityScore >= minScore;

    return matchesSearch && matchesEffort && matchesScore;
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Idea Archive
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse past ideas and find hidden gems
        </p>
      </header>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="effort"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Effort Level
            </label>
            <select
              id="effort"
              value={effortFilter}
              onChange={(e) => setEffortFilter(e.target.value as EffortLevel | "all")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {effortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="score"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Min Score: {minScore}
            </label>
            <input
              id="score"
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {filteredIdeas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>

      {filteredIdeas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No ideas match your filters. Try adjusting your search criteria.
          </p>
        </div>
      )}

      {/* Pagination placeholder */}
      {filteredIdeas.length > 0 && (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredIdeas.length} of {mockArchive.length} ideas
          </p>
        </div>
      )}
    </div>
  );
}
