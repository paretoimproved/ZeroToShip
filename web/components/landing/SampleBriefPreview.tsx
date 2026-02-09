"use client";

import { useRef, useState } from "react";
import { sampleBrief } from "@/lib/sampleData";
import { ScoreBadge, EffortBadge } from "@/components/ScoreBadge";
import { SectionLabel, SectionValue, PillBadge, MonoPill } from "@/components/ui";

const tabs = ["problem", "solution", "tech", "business"] as const;
type TabId = (typeof tabs)[number];

const tabLabels: Record<TabId, string> = {
  problem: "Problem",
  solution: "Solution",
  tech: "Tech Spec",
  business: "Business",
};

function ProblemPanel() {
  return (
    <dl>
      <SectionLabel>The Problem</SectionLabel>
      <SectionValue>{sampleBrief.problemStatement}</SectionValue>

      <SectionLabel>Target Audience</SectionLabel>
      <SectionValue>{sampleBrief.targetAudience}</SectionValue>

      <SectionLabel>Market Size</SectionLabel>
      <SectionValue>{sampleBrief.marketSize}</SectionValue>
    </dl>
  );
}

function SolutionPanel() {
  return (
    <dl>
      <SectionLabel>Proposed Solution</SectionLabel>
      <SectionValue>{sampleBrief.proposedSolution}</SectionValue>

      <SectionLabel>Key Features</SectionLabel>
      <SectionValue>
        <div className="flex flex-wrap gap-2">
          {sampleBrief.keyFeatures.map((feature) => (
            <PillBadge key={feature}>{feature}</PillBadge>
          ))}
        </div>
      </SectionValue>

      <SectionLabel>MVP Scope</SectionLabel>
      <SectionValue>{sampleBrief.mvpScope}</SectionValue>
    </dl>
  );
}

function TechSpecPanel() {
  return (
    <dl>
      <SectionLabel>Stack</SectionLabel>
      <SectionValue>
        <div className="flex flex-wrap gap-2">
          {sampleBrief.technicalSpec.stack.map((tech) => (
            <MonoPill key={tech}>{tech}</MonoPill>
          ))}
        </div>
      </SectionValue>

      <SectionLabel>Architecture</SectionLabel>
      <SectionValue>{sampleBrief.technicalSpec.architecture}</SectionValue>

      <SectionLabel>Estimated Effort</SectionLabel>
      <SectionValue>{sampleBrief.technicalSpec.estimatedEffort}</SectionValue>
    </dl>
  );
}

function BusinessPanel() {
  return (
    <dl>
      <SectionLabel>Pricing Strategy</SectionLabel>
      <SectionValue>{sampleBrief.businessModel.pricing}</SectionValue>

      <SectionLabel>Revenue Projection</SectionLabel>
      <SectionValue>{sampleBrief.businessModel.revenueProjection}</SectionValue>

      <SectionLabel>Launch Strategy</SectionLabel>
      <SectionValue>{sampleBrief.goToMarket.launchStrategy}</SectionValue>

      <SectionLabel>Channels</SectionLabel>
      <SectionValue>
        <div className="flex flex-wrap gap-2">
          {sampleBrief.goToMarket.channels.map((channel) => (
            <PillBadge key={channel}>{channel}</PillBadge>
          ))}
        </div>
      </SectionValue>

      <SectionLabel>First Customers</SectionLabel>
      <SectionValue>{sampleBrief.goToMarket.firstCustomers}</SectionValue>
    </dl>
  );
}

const panelComponents: Record<TabId, React.FC> = {
  problem: ProblemPanel,
  solution: SolutionPanel,
  tech: TechSpecPanel,
  business: BusinessPanel,
};

export default function SampleBriefPreview() {
  const [activeTab, setActiveTab] = useState<TabId>("problem");
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

  const ActivePanel = panelComponents[activeTab];

  return (
    <section
      id="sample-brief"
      aria-labelledby="sample-heading"
      className="py-20 px-4 bg-gray-50 dark:bg-gray-800/50"
    >
      <div className="max-w-3xl mx-auto">
        <h2
          id="sample-heading"
          className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12"
        >
          Here&apos;s What You Get Every Morning
        </h2>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          {/* Card header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-mono text-xl font-bold text-gray-900 dark:text-white">
                  {sampleBrief.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{sampleBrief.tagline}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <ScoreBadge score={sampleBrief.priorityScore} size="sm" />
                <EffortBadge effort={sampleBrief.effortEstimate} size="sm" />
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  {sampleBrief.revenueEstimate}
                </span>
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
                id={`tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls={`panel-${tab}`}
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
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="p-6"
          >
            <div className="transition-opacity duration-200">
              <ActivePanel />
            </div>
          </div>
        </div>

        {/* Below card CTA */}
        <p className="text-center mt-8 text-gray-600 dark:text-gray-400">
          This is one of 10 ideas you&apos;d get tomorrow morning.
        </p>
        <div className="text-center">
          <a
            href="#hero"
            className="inline-block mt-4 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
          >
            Get Started Free
          </a>
        </div>
      </div>
    </section>
  );
}
