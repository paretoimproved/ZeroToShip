import Link from "next/link";
import type { IdeaBrief } from "@/lib/types";
import { ScoreBadge, EffortBadge } from "./ScoreBadge";

interface BriefViewProps {
  brief: IdeaBrief;
  gated?: boolean;
}

export default function BriefView({ brief, gated = false }: BriefViewProps) {
  return (
    <article className="max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <ScoreBadge score={brief.priorityScore} size="lg" />
          <EffortBadge effort={brief.effortEstimate} size="lg" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(brief.generatedAt).toLocaleDateString()}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {brief.name}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 italic">
          {brief.tagline}
        </p>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Revenue Potential</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {brief.revenueEstimate}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Market Size</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {brief.marketSize}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Target Audience</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {brief.targetAudience}
          </div>
        </div>
      </div>

      {gated ? (
        <div
          data-testid="gated-content"
          className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Full Analysis Locked
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Sign up to unlock the complete idea breakdown including technical specs, business model, and go-to-market strategy.
          </p>
          <Link
            href="/landing"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      ) : (
      <div className="space-y-8">
        <Section title="Problem Statement">
          <p className="text-gray-700 dark:text-gray-300">{brief.problemStatement}</p>
        </Section>

        <Section title="Existing Solutions">
          <p className="text-gray-700 dark:text-gray-300">{brief.existingSolutions}</p>
        </Section>

        <Section title="Market Gaps">
          <p className="text-gray-700 dark:text-gray-300">{brief.gaps}</p>
        </Section>

        <Section title="Proposed Solution">
          <p className="text-gray-700 dark:text-gray-300 mb-4">{brief.proposedSolution}</p>

          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Features</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            {brief.keyFeatures.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </Section>

        <Section title="MVP Scope">
          <p className="text-gray-700 dark:text-gray-300">{brief.mvpScope}</p>
        </Section>

        <Section title="Technical Specification">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tech Stack</h4>
              <div className="flex flex-wrap gap-2">
                {brief.technicalSpec.stack.map((tech, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300"
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
        </Section>

        <Section title="Business Model">
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
        </Section>

        <Section title="Go-to-Market Strategy">
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
                    className="px-3 py-1 bg-primary-100 dark:bg-primary-900 rounded-full text-sm text-primary-700 dark:text-primary-300"
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
        </Section>

        <Section title="Risks & Challenges">
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            {brief.risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </Section>
      </div>
      )}
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      {children}
    </section>
  );
}
