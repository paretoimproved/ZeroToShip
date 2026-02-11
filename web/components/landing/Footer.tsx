import Link from "next/link";
import Logo from "@/components/Logo";

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

const resourceLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Archive", href: "/archive" },
] as const;

const companyLinks = [
  {
    label: "Twitter/X",
    href: "#",
    external: true,
  },
  {
    label: "Contact",
    href: "mailto:hello@zerotoship.dev",
    external: true,
  },
] as const;

function RedditIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-gray-500"
    >
      <circle cx={10} cy={11} r={6} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={7.5} cy={10} r={1} fill="currentColor" />
      <circle cx={12.5} cy={10} r={1} fill="currentColor" />
      <path
        d="M7 13c.75 1 2 1.5 3 1.5s2.25-.5 3-1.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
      <line
        x1={10}
        y1={5}
        x2={13}
        y2={2}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={13.5} cy={1.5} r={1} fill="currentColor" />
    </svg>
  );
}

function HNIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-gray-500"
    >
      <rect
        x={2}
        y={2}
        width={16}
        height={16}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M6 5l4 6v4M14 5l-4 6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-gray-500"
    >
      <path
        d="M4 4l5.25 6.25L4 16h1.25l4.25-4.65L13.5 16h2.75L11 9.5 16 4h-1.25l-4 4.35L7 4H4z"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-gray-500"
    >
      <path
        d="M7.5 6l-4 4 4 4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6l4 4-4 4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={11}
        y1={5}
        x2={9}
        y2={15}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="py-12 px-4 bg-gray-900 text-gray-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="text-white">
              <Logo size="sm" />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Daily startup ideas, scraped and scored by AI.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <RedditIcon />
              <HNIcon />
              <GitHubIcon />
            </div>
          </div>

          {/* Product */}
          <div>
            <p className="font-semibold text-white mb-4">Product</p>
            <nav aria-label="Product links">
              {productLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm hover:text-white transition-colors block py-1"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Resources */}
          <div>
            <p className="font-semibold text-white mb-4">Resources</p>
            <nav aria-label="Resource links">
              {resourceLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm hover:text-white transition-colors block py-1"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company */}
          <div>
            <p className="font-semibold text-white mb-4">Company</p>
            <nav aria-label="Company links">
              {companyLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.label === "Twitter/X"
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="text-sm hover:text-white transition-colors block py-1"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} ZeroToShip. All rights reserved.</p>
          <p className="text-gray-500 mt-1">
            Ship ideas, not guesses.
          </p>
        </div>
      </div>
    </footer>
  );
}
