"use client";

import { useRef, useState } from "react";
import { sampleAgentSpec } from "@/lib/sampleSpec";

const tabs = ["stories", "database", "api", "claude"] as const;
type TabId = (typeof tabs)[number];

const tabLabels: Record<TabId, string> = {
  stories: "User Stories",
  database: "Database",
  api: "API Routes",
  claude: "CLAUDE.md",
};

function UserStoriesPanel() {
  return (
    <div className="space-y-6">
      {sampleAgentSpec.userStories.map((story, i) => (
        <div key={i} className="space-y-2">
          <p className="text-gray-900 dark:text-white font-medium">
            As a{" "}
            <span className="text-primary-600 dark:text-primary-400">
              {story.persona}
            </span>
            , I want to{" "}
            <span className="text-primary-600 dark:text-primary-400">
              {story.capability}
            </span>{" "}
            so that{" "}
            <span className="text-primary-600 dark:text-primary-400">
              {story.outcome}
            </span>
            .
          </p>
          <ul className="ml-4 space-y-1">
            {story.acceptanceCriteria.map((criteria, j) => (
              <li
                key={j}
                className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
              >
                <span className="text-green-500 mt-0.5 flex-shrink-0">
                  &#10003;
                </span>
                {criteria}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DatabasePanel() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 pr-4 text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Table
            </th>
            <th className="text-left py-2 pr-4 text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Key Columns
            </th>
            <th className="text-left py-2 text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Relations
            </th>
          </tr>
        </thead>
        <tbody>
          {sampleAgentSpec.technicalArchitecture.databaseSchema.map(
            (schema) => (
              <tr
                key={schema.table}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="py-2.5 pr-4 font-mono text-gray-900 dark:text-white font-medium">
                  {schema.table}
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {schema.keyColumns.map((col) => (
                      <span
                        key={col}
                        className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 text-gray-600 dark:text-gray-400">
                  {schema.relations}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

const methodColors: Record<string, string> = {
  GET: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function ApiRoutesPanel() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 pr-4 text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Method
            </th>
            <th className="text-left py-2 pr-4 text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Route
            </th>
            <th className="text-left py-2 text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              Purpose
            </th>
          </tr>
        </thead>
        <tbody>
          {sampleAgentSpec.technicalArchitecture.apiEndpoints.map(
            (endpoint) => (
              <tr
                key={`${endpoint.method}-${endpoint.route}`}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="py-2.5 pr-4">
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${methodColors[endpoint.method] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                  >
                    {endpoint.method}
                  </span>
                </td>
                <td className="py-2.5 pr-4 font-mono text-gray-900 dark:text-white">
                  {endpoint.route}
                </td>
                <td className="py-2.5 text-gray-600 dark:text-gray-400">
                  {endpoint.purpose}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClaudeMdPanel() {
  return (
    <pre className="bg-gray-950 text-gray-300 text-sm rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
      {sampleAgentSpec.agentInstructions}
    </pre>
  );
}

const panelComponents: Record<TabId, React.FC> = {
  stories: UserStoriesPanel,
  database: DatabasePanel,
  api: ApiRoutesPanel,
  claude: ClaudeMdPanel,
};

export default function SampleSpecShowcase() {
  const [activeTab, setActiveTab] = useState<TabId>("stories");
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
      id="sample-spec"
      aria-labelledby="spec-heading"
      className="py-20 px-4 bg-white dark:bg-gray-900"
    >
      <div className="max-w-3xl mx-auto">
        <h2
          id="spec-heading"
          className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2"
        >
          What a Pro Spec Includes
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Generate complete, agent-ready specs for any problem in the library.
        </p>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          {/* Card header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-mono text-xl font-bold text-gray-900 dark:text-white">
                  {sampleAgentSpec.projectName}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {sampleAgentSpec.problem}
                </p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 flex-shrink-0">
                Pro
              </span>
            </div>
          </div>

          {/* Tab bar */}
          <div
            role="tablist"
            aria-label="Spec sections"
            className="flex border-b border-gray-200 dark:border-gray-700"
            onKeyDown={handleKeyDown}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                id={`spec-tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls={`spec-panel-${tab}`}
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
            id={`spec-panel-${activeTab}`}
            aria-labelledby={`spec-tab-${activeTab}`}
            tabIndex={0}
            className="p-6"
          >
            <div className="transition-opacity duration-200">
              <ActivePanel />
            </div>
          </div>
        </div>

        {/* Below card CTA */}
        <div className="text-center mt-8">
          <a
            href="/signup?plan=pro"
            className="inline-block px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
          >
            Start Generating Specs &mdash; $19/mo
          </a>
        </div>
      </div>
    </section>
  );
}
