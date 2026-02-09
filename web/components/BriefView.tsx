/** @deprecated Use IdeaBriefCard instead */
"use client";

import Link from "next/link";
import type { IdeaBrief } from "@/lib/types";
import { ScoreBadge, EffortBadge } from "./ScoreBadge";
import { PlatformIcon } from "@/components/ui";

interface BriefViewProps {
  brief: IdeaBrief;
  gated?: boolean;
}

export default function BriefView({ brief, gated = false }: BriefViewProps) {
  // Build the list of sections with their index for stagger animation
  const teaserSections = [
    { title: "Problem Statement", index: 0 },
    { title: "Existing Solutions", index: 1 },
    { title: "Market Gaps", index: 2 },
    { title: "Signal Sources", index: 3 },
  ];

  const unlockedSections = [
    { title: "Proposed Solution", index: 4 },
    { title: "MVP Scope", index: 5 },
    { title: "Technical Specification", index: 6 },
    { title: "Business Model", index: 7 },
    { title: "Go-to-Market Strategy", index: 8 },
    { title: "Risks & Challenges", index: 9 },
  ];

  return (
    <article className="max-w-4xl mx-auto">
      {/* Hero-style Header */}
      <header className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <ScoreBadge score={brief.priorityScore} size="lg" />
          <EffortBadge effort={brief.effortEstimate} size="lg" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(brief.generatedAt).toLocaleDateString()}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-2">
          {brief.name}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 italic text-balance">
          {brief.tagline}
        </p>
      </header>

      {/* Quick Stats with Icons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Revenue Potential */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Revenue Potential</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {brief.revenueEstimate}
          </div>
        </div>

        {/* Market Size */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Market Size</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {brief.marketSize}
          </div>
        </div>

        {/* Target Audience */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Target Audience</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {brief.targetAudience}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Teaser sections: always visible, open by default */}
        <CollapsibleSection title="Problem Statement" defaultOpen index={teaserSections[0].index}>
          <p className="text-gray-700 dark:text-gray-300">{brief.problemStatement}</p>
        </CollapsibleSection>

        <CollapsibleSection title="Existing Solutions" defaultOpen index={teaserSections[1].index}>
          <p className="text-gray-700 dark:text-gray-300">{brief.existingSolutions}</p>
        </CollapsibleSection>

        <CollapsibleSection title="Market Gaps" defaultOpen index={teaserSections[2].index}>
          <p className="text-gray-700 dark:text-gray-300">{brief.gaps}</p>
        </CollapsibleSection>

        {brief.sources && brief.sources.length > 0 && (
          <CollapsibleSection title="Signal Sources" defaultOpen index={teaserSections[3].index}>
            <div className="space-y-3">
              {brief.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <PlatformIcon platform={source.platform} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {source.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {source.score} upvotes · {source.commentCount} comments
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {gated ? (
          <div
            data-testid="gated-content"
            className="rounded-xl p-8 border border-primary-200 dark:border-primary-800 text-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 animate-fade-in-up opacity-0"
            style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
          >
            {/* Lock icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Full Analysis Locked
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Sign up to unlock the complete idea breakdown including technical specs, business model, and go-to-market strategy.
            </p>
            <Link
              href="/landing"
              className="inline-block rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Sign Up
            </Link>
          </div>
        ) : (
          <>
            <CollapsibleSection title="Proposed Solution" defaultOpen index={unlockedSections[0].index}>
              <p className="text-gray-700 dark:text-gray-300 mb-4">{brief.proposedSolution}</p>

              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Features</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                {brief.keyFeatures.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CollapsibleSection>

            <CollapsibleSection title="MVP Scope" defaultOpen index={unlockedSections[1].index}>
              <p className="text-gray-700 dark:text-gray-300">{brief.mvpScope}</p>
            </CollapsibleSection>

            <CollapsibleSection title="Technical Specification" defaultOpen index={unlockedSections[2].index}>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tech Stack</h4>
                  <div className="flex flex-wrap gap-2">
                    {brief.technicalSpec.stack.map((tech, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Architecture</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.technicalSpec.architecture}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Estimated Effort</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.technicalSpec.estimatedEffort}</p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Business Model" defaultOpen index={unlockedSections[3].index}>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Pricing</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.businessModel.pricing}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Revenue Projection</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.businessModel.revenueProjection}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Monetization Path</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.businessModel.monetizationPath}</p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Go-to-Market Strategy" defaultOpen index={unlockedSections[4].index}>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Launch Strategy</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.goToMarket.launchStrategy}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Channels</h4>
                  <div className="flex flex-wrap gap-2">
                    {brief.goToMarket.channels.map((channel, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary-100 dark:bg-primary-900 rounded-full text-sm text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">First Customers</h4>
                  <p className="text-gray-700 dark:text-gray-300">{brief.goToMarket.firstCustomers}</p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Risks & Challenges" defaultOpen index={unlockedSections[5].index}>
              <div className="space-y-3">
                {brief.risks.map((risk, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800"
                  >
                    <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-amber-800 dark:text-amber-200">{risk}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </>
        )}
      </div>
    </article>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  index = 0,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  index?: number;
}) {
  return (
    <details
      open={defaultOpen || undefined}
      className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
    >
      <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronIcon className="w-5 h-5 text-gray-500 transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-4" />
      </summary>
      <div className="details-content">
        <div>
          <div className="px-6 pb-6">{children}</div>
        </div>
      </div>
    </details>
  );
}

function ChevronIcon({ className }: { className: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
