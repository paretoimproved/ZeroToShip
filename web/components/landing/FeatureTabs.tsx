"use client";

import { useState, useRef, useCallback, type KeyboardEvent, type ReactNode } from "react";

type TabId = "discover" | "evaluate" | "build";

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
}

interface TabDefinition {
  id: TabId;
  label: string;
  features: FeatureItem[];
}

const TABS: TabDefinition[] = [
  {
    id: "discover",
    label: "Discover",
    features: [
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 10h16M10 2a14 14 0 0 1 4 8 14 14 0 0 1-4 8 14 14 0 0 1-4-8 14 14 0 0 1 4-8Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 4.5l-3 -2M13.5 4.5l3-2M6.5 15.5l-3 2M13.5 15.5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
        title: "Multi-Source Scraping",
        description: "Reddit, Hacker News, and GitHub scraped daily for real pain points.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="3" y="2" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <rect x="6" y="4" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <line x1="9" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="14" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
        title: "300+ Posts Daily",
        description: "Hundreds of posts analyzed every morning before you wake up.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 13a4 4 0 0 0 4 4h1a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16 7a4 4 0 0 0-4-4h-1a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
        title: "8 Subreddit Coverage",
        description: "r/startups, r/SideProject, r/webdev, and 5 more niche communities.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <line x1="5" y1="4" x2="5" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="4" x2="15" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="5" cy="7" r="2" fill="currentColor" />
            <circle cx="10" cy="13" r="2" fill="currentColor" />
            <circle cx="15" cy="10" r="2" fill="currentColor" />
          </svg>
        ),
        title: "Custom Categories",
        description: "Set your preferences: developer tools, SaaS, AI/ML, consumer apps, and more.",
      },
    ],
  },
  {
    id: "evaluate",
    label: "Evaluate",
    features: [
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="3" y="12" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
            <rect x="8.5" y="8" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.6" />
            <rect x="14" y="3" width="3" height="15" rx="0.5" fill="currentColor" />
          </svg>
        ),
        title: "Priority Scoring (0-100)",
        description: "AI evaluates frequency, severity, market size, and technical complexity.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="10,5 10,10 14,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "Effort Estimation",
        description: "Weekend project? Month-long build? Know before you commit.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 3v14M7 6.5C7 5.12 8.34 4 10 4s3 1.12 3 2.5S11.66 9 10 9 7 10.12 7 11.5 8.34 14 10 14s3-1.12 3-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
        title: "Revenue Potential",
        description: "Estimated revenue range based on market size and pricing models.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2l2 6h-4l2-6Z" fill="currentColor" />
            <path d="M10 8v10M7 12l3-4 3 4M5.5 15l4.5-3 4.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "Quick Wins Filter",
        description: "Surface ideas you can ship this weekend and start earning.",
      },
    ],
  },
  {
    id: "build",
    label: "Build",
    features: [
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M6 4l-4 6 4 6M14 4l4 6-4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="3" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
        title: "Full Technical Specs",
        description: "Recommended stack, architecture, and MVP scope for every idea.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="13" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 17c0-2.76 2.24-4 5-4s5 1.24 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13 13c2.76 0 5 1.24 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
        title: "Competitor Analysis",
        description: "Existing solutions mapped with gaps your product can fill.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 11V9a2 2 0 0 1 2-2h2l3-4 3 4h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 11l4 6h10l4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "Go-to-Market Strategy",
        description: "Launch channels, first customers, and growth playbook included.",
      },
      {
        icon: (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4V2M13 4V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="6" y="8" width="3" height="2" rx="0.5" fill="currentColor" />
            <rect x="11" y="8" width="3" height="2" rx="0.5" fill="currentColor" />
            <rect x="6" y="12" width="3" height="1.5" rx="0.5" fill="currentColor" />
          </svg>
        ),
        title: "Business Model",
        description: "Pricing strategy, monetization path, and revenue projections.",
      },
    ],
  },
];

const TAB_IDS: TabId[] = ["discover", "evaluate", "build"];

export default function FeatureTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("discover");
  const tabRefs = useRef<Map<TabId, HTMLButtonElement>>(new Map());

  const setTabRef = useCallback((id: TabId) => (el: HTMLButtonElement | null) => {
    if (el) {
      tabRefs.current.set(id, el);
    } else {
      tabRefs.current.delete(id);
    }
  }, []);

  const switchTab = useCallback((id: TabId) => {
    setActiveTab(id);
    tabRefs.current.get(id)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = TAB_IDS.indexOf(activeTab);
      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
          nextIndex = (currentIndex + 1) % TAB_IDS.length;
          break;
        case "ArrowLeft":
          nextIndex = (currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = TAB_IDS.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      switchTab(TAB_IDS[nextIndex]);
    },
    [activeTab, switchTab],
  );

  const activeTabData = TABS.find((tab) => tab.id === activeTab);

  return (
    <section aria-labelledby="features-heading" className="py-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h2
          id="features-heading"
          className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl"
        >
          Everything You Need to Ship Faster
        </h2>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          From discovery to launch — ZeroToShip covers the full journey.
        </p>

        <div className="mt-10 flex justify-center">
          <div
            role="tablist"
            aria-label="Feature categories"
            className="inline-flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-full"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={setTabRef(tab.id)}
                  role="tab"
                  id={`feature-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`feature-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => switchTab(tab.id)}
                  onKeyDown={handleKeyDown}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTabData && (
          <div
            key={activeTabData.id}
            role="tabpanel"
            id={`feature-panel-${activeTabData.id}`}
            aria-labelledby={`feature-tab-${activeTabData.id}`}
            tabIndex={0}
          >
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 text-left">
              {activeTabData.features.map((feature) => (
                <li key={feature.title} className="p-4">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
                    {feature.icon}
                  </div>
                  <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
