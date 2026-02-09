const faqItems = [
  {
    question: "How is this different from browsing Reddit/HN myself?",
    answer:
      "We scrape 300+ posts daily across 8 subreddits, Hacker News, Twitter, and GitHub. Then AI clusters similar problems, scores them by opportunity, and generates technical specs. You'd spend hours doing this manually \u2014 we do it in minutes and deliver the best ideas to your inbox.",
  },
  {
    question: "What sources do you scrape?",
    answer:
      "Reddit (r/startups, r/SideProject, r/webdev, and 5 more), Hacker News (Ask HN, Show HN, comments), Twitter (#buildinpublic, #indiehacker), and GitHub issues from repos with 500+ stars.",
  },
  {
    question: "Can I get ideas for specific niches?",
    answer:
      "Yes! Pro members can set category preferences (developer tools, SaaS, AI/ML, consumer apps, etc.) and we'll prioritize matching ideas.",
  },
  {
    question: "How are ideas scored?",
    answer:
      "Our AI evaluates frequency (how often mentioned), severity (how painful), market size (how many affected), technical complexity, and time to MVP. The priority score balances opportunity against effort.",
  },
  {
    question: "What's included in the full brief?",
    answer:
      "Problem statement, target audience, existing solutions, market gaps, technical spec (stack, architecture, MVP scope), business model, pricing strategy, go-to-market plan, and risk assessment.",
  },
  {
    question: "How fresh are the ideas?",
    answer:
      "Ideas are generated fresh every morning at 8 AM based on the previous 24\u201348 hours of posts. You'll never see the same idea twice.",
  },
  {
    question: "Is my data private?",
    answer:
      "Absolutely. Your preferences, saved ideas, and browsing activity are never shared. We scrape publicly available posts \u2014 we don't access any private data.",
  },
  {
    question: "Is there a refund policy?",
    answer:
      "Yes. If you're not satisfied within the first 14 days, we'll refund your payment in full. No questions asked.",
  },
] as const;

function ChevronIcon({ className }: { className: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FAQSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-20 px-4 bg-gray-50 dark:bg-gray-800/50"
    >
      <div className="max-w-3xl mx-auto">
        <h2
          id="faq-heading"
          className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12"
        >
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronIcon className="w-5 h-5 text-gray-500 transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-4" />
              </summary>
              <div className="details-content">
                <div>
                  <p className="px-6 pb-6 text-gray-600 dark:text-gray-400">
                    {item.answer}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
