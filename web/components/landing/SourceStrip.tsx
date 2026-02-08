const sources = [
  {
    name: "Reddit",
    description: "8 subreddits — complaints, wish lists, feature requests",
    icon: (
      <svg
        width={40}
        height={40}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="text-primary-600 dark:text-primary-400"
      >
        {/* Circle head */}
        <circle cx={20} cy={22} r={12} stroke="currentColor" strokeWidth={2.5} />
        {/* Left eye */}
        <circle cx={15} cy={20} r={2} fill="currentColor" />
        {/* Right eye */}
        <circle cx={25} cy={20} r={2} fill="currentColor" />
        {/* Smile */}
        <path
          d="M14 26c1.5 2 4 3 6 3s4.5-1 6-3"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        {/* Antenna stalk */}
        <line x1={20} y1={10} x2={26} y2={4} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
        {/* Antenna tip */}
        <circle cx={27} cy={3} r={2} fill="currentColor" />
        {/* Left ear */}
        <line x1={10} y1={16} x2={7} y2={12} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
        {/* Right ear */}
        <line x1={30} y1={16} x2={33} y2={12} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Hacker News",
    description: "Ask HN, Show HN — 200+ comments analyzed daily",
    icon: (
      <svg
        width={40}
        height={40}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="text-primary-600 dark:text-primary-400"
      >
        {/* Square border */}
        <rect x={4} y={4} width={32} height={32} rx={4} stroke="currentColor" strokeWidth={2.5} />
        {/* Y letter */}
        <path
          d="M12 10l8 12v8M28 10l-8 12"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "Twitter / X",
    description: "#buildinpublic, #indiehacker pain points",
    icon: (
      <svg
        width={40}
        height={40}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="text-primary-600 dark:text-primary-400"
      >
        {/* X shape */}
        <path
          d="M8 8l10.5 12.5L8 32h2.5l8.5-9.3L27 32h5.5L21.5 19 32 8h-2.5l-8 8.7L14 8H8z"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    name: "GitHub",
    description: "Issues from repos with 500+ stars",
    icon: (
      <svg
        width={40}
        height={40}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="text-primary-600 dark:text-primary-400"
      >
        {/* Code bracket icon: < /> */}
        <path
          d="M15 12l-8 8 8 8"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M25 12l8 8-8 8"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={22}
          y1={10}
          x2={18}
          y2={30}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

export default function SourceStrip() {
  return (
    <section aria-labelledby="source-heading" className="py-16 px-4 bg-gray-50 dark:bg-gray-800/50">
      <div className="max-w-5xl mx-auto">
        <h2
          id="source-heading"
          className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12"
        >
          Sourced from where builders actually talk
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sources.map((source) => (
            <article
              key={source.name}
              className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
            >
              <div className="mb-4">{source.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {source.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {source.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
