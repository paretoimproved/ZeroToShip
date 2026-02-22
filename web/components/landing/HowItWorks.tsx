"use client";

import { useEffect, useState } from "react";
import { useIntersectionObserver } from "@/lib/useIntersectionObserver";

const steps = [
  {
    number: 1,
    title: "We Scrape",
    description:
      "Every morning, we scan 300+ posts across Reddit, Hacker News, and GitHub for real problems people are complaining about.",
    icon: (
      <svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="text-primary-600 dark:text-primary-400"
      >
        {/* Magnifying glass */}
        <circle cx={14} cy={14} r={9} stroke="currentColor" strokeWidth={2.5} />
        <line
          x1={21}
          y1={21}
          x2={29}
          y2={29}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    number: 2,
    title: "AI Analyzes",
    description:
      "Our AI clusters similar problems, scores them by opportunity (frequency \u00d7 severity \u00d7 market size), and generates agent-ready specs with technical architecture and MVP scope.",
    icon: (
      <svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="text-primary-600 dark:text-primary-400"
      >
        {/* Brain / analytics chart icon */}
        <rect x={4} y={18} width={5} height={10} rx={1} fill="currentColor" opacity={0.6} />
        <rect x={13.5} y={12} width={5} height={16} rx={1} fill="currentColor" opacity={0.8} />
        <rect x={23} y={4} width={5} height={24} rx={1} fill="currentColor" />
        {/* Trend line */}
        <path
          d="M6.5 16L16 8l10 -4"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    number: 3,
    title: "You Ship",
    description:
      "Browse the problem library, generate a spec, and hand it to Claude Code, Cursor, or your favorite AI agent. Go from validated problem to working code tonight.",
    icon: (
      <svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="text-primary-600 dark:text-primary-400"
      >
        {/* Rocket */}
        <path
          d="M16 4c-4 6-6 12-6 18h12c0-6-2-12-6-18z"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* Flame */}
        <path
          d="M13 22c1 3 2 5 3 6 1-1 2-3 3-6"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Window */}
        <circle cx={16} cy={14} r={2.5} stroke="currentColor" strokeWidth={2} />
        {/* Left fin */}
        <path d="M10 22l-4-2 4-6" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        {/* Right fin */}
        <path d="M22 22l4-2-4-6" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      </svg>
    ),
  },
] as const;

const delayClasses = ["delay-0", "delay-150", "delay-300"] as const;

export default function HowItWorks() {
  const [sectionRef, isVisible] = useIntersectionObserver({ threshold: 0.15 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Progressive enhancement: visible by default (SSR), animate only after hydration
  const shouldAnimate = hydrated && !prefersReducedMotion;
  const showContent = !hydrated || isVisible || prefersReducedMotion;

  return (
    <section
      id="features"
      aria-labelledby="how-heading"
      className="py-20 px-4"
      ref={sectionRef as React.RefObject<HTMLElement>}
    >
      <div className="max-w-5xl mx-auto">
        <h2
          id="how-heading"
          className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4"
        >
          How ZeroToShip Works
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-16 max-w-2xl mx-auto">
          From raw social media posts to agent-ready specs &mdash; fully automated, updated
          daily.
        </p>

        <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {/* Desktop connecting line */}
          <li
            className="hidden md:block absolute top-8 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] border-t-2 border-dashed border-gray-300 dark:border-gray-600"
            aria-hidden="true"
            style={{ listStyle: "none" }}
          />

          {/* Mobile connecting line */}
          <li
            className="md:hidden absolute top-12 bottom-12 left-6 border-l-2 border-dashed border-gray-300 dark:border-gray-600"
            aria-hidden="true"
            style={{ listStyle: "none" }}
          />

          {steps.map((step, index) => (
            <li
              key={step.number}
              className={[
                "relative flex flex-row md:flex-col items-start md:items-center md:text-center gap-4 md:gap-0 pl-14 md:pl-0",
                shouldAnimate
                  ? `transition-all duration-700 ease-out ${delayClasses[index]}`
                  : "",
                shouldAnimate && !showContent
                  ? "opacity-0 translate-y-4"
                  : "opacity-100 translate-y-0",
              ].join(" ")}
            >
              {/* Step number badge */}
              <div className="absolute left-0 md:relative md:left-auto flex-shrink-0 w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-lg font-bold z-10 md:mb-6">
                {step.number}
              </div>

              <div className="flex flex-col md:items-center">
                {/* Icon */}
                <div className="mb-3 flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/50">
                  {step.icon}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 text-sm md:max-w-xs">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
