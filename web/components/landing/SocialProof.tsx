const testimonials = [
  {
    quote:
      "I spent weeks scrolling Reddit looking for ideas. ZeroToShip gave me a validated problem with a full spec in 10 minutes. Shipped my MVP that weekend.",
    name: "Alex M.",
    role: "Indie Hacker",
  },
  {
    quote:
      "The specs are shockingly good. I dropped one into Cursor and had a working prototype before lunch. This is how I find every project now.",
    name: "Priya K.",
    role: "Solo Founder",
  },
  {
    quote:
      "Stopped guessing what to build. The problem scoring alone is worth it — I only work on ideas with real demand now.",
    name: "Jordan T.",
    role: "Side Project Builder",
  },
] as const;

const stats = [
  { value: "300+", label: "Problems scraped daily" },
  { value: "8+", label: "Sources monitored" },
  { value: "500+", label: "Indie hackers building" },
] as const;

function QuoteIcon({ className }: { className: string }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.166 11 15c0 1.933-1.567 3.5-3.5 3.5-1.174 0-2.292-.534-2.917-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.69 21 13.166 21 15c0 1.933-1.567 3.5-3.5 3.5-1.174 0-2.292-.534-2.917-1.179z" />
    </svg>
  );
}

export default function SocialProof() {
  return (
    <section aria-labelledby="social-proof-heading" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2
          id="social-proof-heading"
          className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4"
        >
          Builders are shipping faster
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          Join hundreds of indie hackers who stopped guessing and started
          building with validated problems.
        </p>

        {/* Stats strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {stat.value}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <blockquote
              key={testimonial.name}
              className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
            >
              <QuoteIcon className="text-primary-200 dark:text-primary-800 mb-3 flex-shrink-0" />
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed flex-1">
                {testimonial.quote}
              </p>
              <footer className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {testimonial.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {testimonial.role}
                </p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
