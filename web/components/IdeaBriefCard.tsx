"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { IdeaBrief } from "@/lib/types";
import { ScoreBadge, EffortBadge } from "@/components/ScoreBadge";
import { SectionLabel, SectionValue, PillBadge, MonoPill, PlatformIcon } from "@/components/ui";
import { humanizeText } from "@/lib/humanize";

const allTabs = ["problem", "solution", "tech", "business", "sources"] as const;
type TabId = (typeof allTabs)[number];

const tabLabels: Record<TabId, string> = {
  problem: "Problem",
  solution: "Solution",
  tech: "Tech Spec",
  business: "Business",
  sources: "Sources",
};

const gatedTabs: Set<TabId> = new Set(["solution", "tech", "business"]);

interface IdeaBriefCardProps {
  brief: IdeaBrief;
  rank?: number;
  index?: number;
  gated?: boolean;
  gatedAction?: 'signup' | 'upgrade';
  defaultTab?: TabId;
  /** Optional bookmark button to render in the card header */
  bookmarkSlot?: React.ReactNode;
}

export default function IdeaBriefCard({
  brief,
  rank,
  index,
  gated = false,
  gatedAction = "signup",
  defaultTab = "problem",
  bookmarkSlot,
}: IdeaBriefCardProps) {
  const hasSources = brief.sources && brief.sources.length > 0;
  const tabs: readonly TabId[] = hasSources ? allTabs : allTabs.filter((t) => t !== "sources");

  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const tabButtonRefs = useRef<Map<TabId, HTMLButtonElement>>(new Map());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.indexOf(activeTab);
    let nextTab: TabId | undefined;

    if (e.key === "ArrowRight") {
      nextTab = tabs[(currentIndex + 1) % tabs.length];
    } else if (e.key === "ArrowLeft") {
      nextTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
    } else if (e.key === "Home") {
      nextTab = tabs[0];
    } else if (e.key === "End") {
      nextTab = tabs[tabs.length - 1];
    }

    if (nextTab) {
      e.preventDefault();
      setActiveTab(nextTab);
      tabButtonRefs.current.get(nextTab)?.focus();
    }
  };

  const showGatedOverlay = gated && gatedTabs.has(activeTab);

  const revenueEstimate = humanizeText(brief.revenueEstimate);

  return (
    <article
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-fade-in-up opacity-0"
      style={{
        animationDelay: `${(index ?? 0) * 150}ms`,
        animationFillMode: "forwards",
      }}
    >
      {/* Card header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {rank !== undefined && (
              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                  {rank}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-mono text-xl font-bold text-gray-900 dark:text-white">
                {brief.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{brief.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:max-w-[55%] min-w-0">
            <ScoreBadge score={brief.priorityScore} size="sm" />
            <EffortBadge effort={brief.effortEstimate} size="sm" />
            <span
              title={revenueEstimate}
              className={[
                // Prevent long AI-generated strings from blowing up the layout.
                // We show the full value on hover via `title`.
                "hidden sm:inline-flex items-center text-xs font-medium",
                "px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
                "min-w-0 max-w-full sm:max-w-[360px] truncate whitespace-nowrap",
              ].join(" ")}
            >
              <span className="min-w-0 truncate whitespace-nowrap">{revenueEstimate}</span>
            </span>
            {bookmarkSlot}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Brief sections"
        className="flex border-b border-gray-200 dark:border-gray-700"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            id={`tab-${brief.id}-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${brief.id}-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            ref={(el) => {
              if (el) {
                tabButtonRefs.current.set(tab, el);
              } else {
                tabButtonRefs.current.delete(tab);
              }
            }}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab
                ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            ].join(" ")}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={`panel-${brief.id}-${activeTab}`}
        aria-labelledby={`tab-${brief.id}-${activeTab}`}
        tabIndex={0}
        className="p-6"
      >
        {showGatedOverlay ? (
          <GatedPanel action={gatedAction} />
        ) : (
          <div className="transition-opacity duration-200">
            {activeTab === "problem" && <ProblemPanel brief={brief} />}
            {activeTab === "solution" && <SolutionPanel brief={brief} />}
            {activeTab === "tech" && <TechSpecPanel brief={brief} />}
            {activeTab === "business" && <BusinessPanel brief={brief} />}
            {activeTab === "sources" && <SourcesPanel brief={brief} />}
          </div>
        )}
      </div>
    </article>
  );
}

function ProblemPanel({ brief }: { brief: IdeaBrief }) {
  return (
    <dl>
      <SectionLabel>The Problem</SectionLabel>
      <SectionValue>{humanizeText(brief.problemStatement)}</SectionValue>

      <SectionLabel>Target Audience</SectionLabel>
      <SectionValue>{humanizeText(brief.targetAudience)}</SectionValue>

      <SectionLabel>Market Size</SectionLabel>
      <SectionValue>{humanizeText(brief.marketSize)}</SectionValue>

      <SectionLabel>Existing Solutions</SectionLabel>
      <SectionValue>{humanizeText(brief.existingSolutions)}</SectionValue>

      <SectionLabel>Market Gaps</SectionLabel>
      <SectionValue>{humanizeText(brief.gaps)}</SectionValue>
    </dl>
  );
}

function SolutionPanel({ brief }: { brief: IdeaBrief }) {
  return (
    <dl>
      <SectionLabel>Proposed Solution</SectionLabel>
      <SectionValue>{humanizeText(brief.proposedSolution)}</SectionValue>

      <SectionLabel>Key Features</SectionLabel>
      <SectionValue>
        <div className="flex flex-wrap gap-2">
          {brief.keyFeatures.map((feature) => (
            <PillBadge key={feature}>{humanizeText(feature)}</PillBadge>
          ))}
        </div>
      </SectionValue>

      <SectionLabel>MVP Scope</SectionLabel>
      <SectionValue>{humanizeText(brief.mvpScope)}</SectionValue>
    </dl>
  );
}

function TechSpecPanel({ brief }: { brief: IdeaBrief }) {
  return (
    <dl>
      <SectionLabel>Stack</SectionLabel>
      <SectionValue>
        <div className="flex flex-wrap gap-2">
          {brief.technicalSpec.stack.map((tech) => (
            <MonoPill key={tech}>{tech}</MonoPill>
          ))}
        </div>
      </SectionValue>

      <SectionLabel>Architecture</SectionLabel>
      <SectionValue>{humanizeText(brief.technicalSpec.architecture)}</SectionValue>

      <SectionLabel>Estimated Effort</SectionLabel>
      <SectionValue>{humanizeText(brief.technicalSpec.estimatedEffort)}</SectionValue>
    </dl>
  );
}

function BusinessPanel({ brief }: { brief: IdeaBrief }) {
  return (
    <dl>
      <SectionLabel>Pricing Strategy</SectionLabel>
      <SectionValue>{humanizeText(brief.businessModel.pricing)}</SectionValue>

      <SectionLabel>Revenue Projection</SectionLabel>
      <SectionValue>{humanizeText(brief.businessModel.revenueProjection)}</SectionValue>

      <SectionLabel>Monetization Path</SectionLabel>
      <SectionValue>{humanizeText(brief.businessModel.monetizationPath)}</SectionValue>

      <SectionLabel>Launch Strategy</SectionLabel>
      <SectionValue>{humanizeText(brief.goToMarket.launchStrategy)}</SectionValue>

      <SectionLabel>Channels</SectionLabel>
      <SectionValue>
        <div className="flex flex-wrap gap-2">
          {brief.goToMarket.channels.map((channel) => (
            <PillBadge key={channel}>{humanizeText(channel)}</PillBadge>
          ))}
        </div>
      </SectionValue>

      <SectionLabel>First Customers</SectionLabel>
      <SectionValue>{humanizeText(brief.goToMarket.firstCustomers)}</SectionValue>

      {brief.risks.length > 0 && (
        <>
          <SectionLabel>Risks</SectionLabel>
          <SectionValue>
            <div className="space-y-3">
              {brief.risks.map((risk, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800"
                >
                  <svg
                    className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-amber-800 dark:text-amber-200">{humanizeText(risk)}</span>
                </div>
              ))}
            </div>
          </SectionValue>
        </>
      )}
    </dl>
  );
}

function SourcesPanel({ brief }: { brief: IdeaBrief }) {
  if (!brief.sources || brief.sources.length === 0) return null;

  const getPlatformLabel = (platform: string) => {
    if (platform === "hn") return "Hacker News";
    if (platform === "reddit") return "Reddit";
    if (platform === "twitter") return "Twitter/X";
    if (platform === "github") return "GitHub";
    return platform;
  };

  return (
    <div className="space-y-3">
      {brief.sources.map((source, i) => (
        <a
          key={i}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            <PlatformIcon platform={source.platform} size="sm" />
            <span
              title={source.platform === "hn" ? "HN is short for Hacker News" : undefined}
              className="text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              {getPlatformLabel(source.platform)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {source.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {source.score} points · {source.commentCount} comments
            </div>
          </div>
          <svg
            className="w-4 h-4 text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      ))}
    </div>
  );
}

function GatedPanel({ action = "signup" }: { action?: "signup" | "upgrade" }) {
  const isUpgrade = action === "upgrade";
  return (
    <div
      data-testid="gated-content"
      className="rounded-xl p-8 border border-primary-200 dark:border-primary-800 text-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30"
    >
      <div className="mx-auto w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-primary-600 dark:text-primary-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Full Analysis Locked
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        {isUpgrade
          ? "Upgrade to Builder to unlock the complete idea breakdown including technical specs, business model, and go-to-market strategy."
          : "Sign up to unlock the complete idea breakdown including technical specs, business model, and go-to-market strategy."}
      </p>
      <Link
        href={isUpgrade ? "/pricing" : "/signup"}
        className="inline-block rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      >
        {isUpgrade ? "Upgrade to Builder" : "Sign Up"}
      </Link>
    </div>
  );
}
