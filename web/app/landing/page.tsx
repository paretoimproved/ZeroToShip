"use client";

import Link from "next/link";
import { useState } from "react";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "Daily Ideas from Real Pain Points",
    description: "Every morning at 8 AM, we scrape Reddit, Hacker News, Twitter, and GitHub for problems people actually have. No more guessing what to build.",
    bullets: [
      "8 subreddits monitored for complaints and wishes",
      "Hacker News \"Ask HN\" threads analyzed",
      "Twitter #buildinpublic pain points captured",
      "GitHub issues from 500+ star repos",
    ],
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "AI-Scored by Real Opportunity",
    description: "Each idea gets a priority score based on frequency, severity, market size, and technical complexity. Spend your time on ideas worth building.",
    bullets: [
      "Priority score from 0-100",
      "Effort estimate (weekend → quarter)",
      "Revenue potential estimate",
      "Quick wins filter for fast shipping",
    ],
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    title: "Complete Technical Specs Included",
    description: "Stop planning, start building. Every idea includes the tech stack, architecture, MVP scope, and go-to-market strategy.",
    bullets: [
      "Recommended tech stack by effort level",
      "MVP scope and first features",
      "Competitor analysis with market gaps",
      "Launch channel recommendations",
    ],
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "From Idea to Revenue in Weeks",
    description: "Each brief includes a business model and pricing strategy. Know exactly how to monetize before you write a line of code.",
    bullets: [
      "Business model recommendations",
      "Pricing strategy guidance",
      "First customer acquisition channels",
      "Risk assessment",
    ],
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$0",
    period: "/month",
    description: "Perfect for exploring what's possible",
    features: [
      "3 ideas per day",
      "Problem statement",
      "Target audience",
      "Basic solution outline",
      "Email delivery",
    ],
    limitations: [
      "No full technical specs",
      "No competitor analysis",
      "No archive access",
    ],
    cta: "Get Started Free",
    ctaLink: "/signup",
    highlighted: false,
  },
  {
    name: "Builder",
    price: "$19",
    period: "/month",
    description: "Everything you need to find and validate ideas",
    features: [
      "10 ideas per day",
      "Full technical specs",
      "Competitor analysis",
      "Business model & pricing",
      "Go-to-market strategy",
      "Full archive access",
      "Priority email delivery",
    ],
    limitations: [],
    cta: "Start Building",
    ctaLink: "/signup?plan=pro",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Team",
    price: "$99",
    period: "/month",
    description: "For agencies and serial builders",
    features: [
      "Unlimited ideas",
      "API access",
      "Custom category filters",
      "Idea validation reports",
      "Export to Notion/CSV",
      "Team sharing (coming soon)",
      "Priority support",
    ],
    limitations: [],
    cta: "Contact Us",
    ctaLink: "/contact",
    highlighted: false,
  },
];

const faqs = [
  {
    question: "How is this different from browsing Reddit/HN myself?",
    answer: "We scrape 300+ posts daily across 8 subreddits, Hacker News, Twitter, and GitHub. Then AI clusters similar problems, scores them by opportunity, and generates technical specs. You'd spend hours doing this manually—we do it in minutes and deliver the best ideas to your inbox.",
  },
  {
    question: "What sources do you scrape?",
    answer: "Reddit (r/startups, r/SideProject, r/webdev, and 5 more), Hacker News (Ask HN, Show HN, comments), Twitter (#buildinpublic, #indiehacker), and GitHub issues from repos with 500+ stars.",
  },
  {
    question: "Can I get ideas for specific niches?",
    answer: "With Pro and Enterprise plans, you can set category preferences (developer tools, SaaS, AI/ML, consumer apps, etc.) and we'll prioritize matching ideas.",
  },
  {
    question: "How are ideas scored?",
    answer: "Our AI evaluates frequency (how often mentioned), severity (how painful), market size (how many affected), technical complexity, and time to MVP. The priority score balances opportunity against effort.",
  },
  {
    question: "What's included in the full brief?",
    answer: "Problem statement, target audience, existing solutions, market gaps, technical spec (stack, architecture, MVP scope), business model, pricing strategy, go-to-market plan, and risk assessment.",
  },
  {
    question: "How fresh are the ideas?",
    answer: "Ideas are generated fresh every morning at 8 AM based on the previous 24-48 hours of posts. You'll never see the same idea twice.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Stop Scrolling.{" "}
            <span className="text-primary-600 dark:text-primary-400">Start Building.</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Every morning, get 10 startup ideas scraped from Reddit, HN, and Twitter—scored by opportunity, with technical specs included.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Get Your First Ideas Free
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors text-lg"
            >
              See How It Works
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">300+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Posts scraped daily</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">AI</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Scored by opportunity</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">Full</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Technical specs included</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 px-4 bg-gray-100 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Sound Familiar?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
              <div className="text-4xl mb-4">😩</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Endless Scrolling</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Spending hours on Reddit and HN looking for problems to solve, then forgetting what you found.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No Time to Validate</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Building first, validating later—then realizing nobody wants what you made.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
              <div className="text-4xl mb-4">💭</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">&quot;I Should Have Built That&quot;</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Seeing someone else launch what you thought about months ago. Every. Single. Time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
            How IdeaForge Works
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-16 max-w-2xl mx-auto">
            From raw social media posts to validated business briefs—fully automated, delivered daily.
          </p>

          <div className="space-y-16">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`flex flex-col ${
                  index % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
                } gap-8 items-center`}
              >
                <div className="flex-1">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl text-primary-600 dark:text-primary-400 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 w-full">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-xl aspect-video flex items-center justify-center text-gray-400 dark:text-gray-500">
                    [Screenshot Placeholder]
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gray-100 dark:bg-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Simple Pricing, Serious Value
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
            Start free. Upgrade when you&apos;re ready to ship faster.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white dark:bg-gray-900 rounded-2xl p-8 ${
                  plan.highlighted
                    ? "ring-2 ring-primary-500 shadow-xl"
                    : "border border-gray-200 dark:border-gray-700"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                  <span className="text-gray-600 dark:text-gray-400">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {plan.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                  {plan.limitations.map((limitation, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      {limitation}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.ctaLink}
                  className={`block w-full py-3 text-center font-semibold rounded-lg transition-colors ${
                    plan.highlighted
                      ? "bg-primary-600 hover:bg-primary-700 text-white"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {faq.question}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary-600 dark:bg-primary-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Find Your Next Idea?
          </h2>
          <p className="text-primary-100 mb-8">
            No credit card required. 3 ideas/day on the free plan.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-lg"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-5xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="text-xl font-bold text-white mb-4">IdeaForge</div>
            <p className="text-sm">
              Daily startup ideas, scraped and scored by AI.
            </p>
          </div>
          <div>
            <div className="font-semibold text-white mb-4">Product</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="#features" className="hover:text-white">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="#faq" className="hover:text-white">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-white mb-4">Company</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white">About</Link></li>
              <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-white mb-4">Legal</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-8 border-t border-gray-800 text-sm text-center">
          &copy; {new Date().getFullYear()} IdeaForge. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
