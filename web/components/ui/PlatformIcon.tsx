function RedditSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <circle cx={20} cy={22} r={12} stroke="currentColor" strokeWidth={2.5} />
      <circle cx={15} cy={20} r={2} fill="currentColor" />
      <circle cx={25} cy={20} r={2} fill="currentColor" />
      <path d="M14 26c1.5 2 4 3 6 3s4.5-1 6-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none" />
      <line x1={20} y1={10} x2={26} y2={4} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={27} cy={3} r={2} fill="currentColor" />
      <line x1={10} y1={16} x2={7} y2={12} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={30} y1={16} x2={33} y2={12} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

function HackerNewsSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <rect x={4} y={4} width={32} height={32} rx={4} stroke="currentColor" strokeWidth={2.5} />
      <path d="M12 10l8 12v8M28 10l-8 12" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GitHubSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <path d="M15 12l-8 8 8 8" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 12l8 8-8 8" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={22} y1={10} x2={18} y2={30} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

const platformSvgs: Record<string, React.FC<{ className?: string }>> = {
  reddit: RedditSvg,
  hn: HackerNewsSvg,
  github: GitHubSvg,
};

const platformColors: Record<string, string> = {
  reddit: "text-orange-600 dark:text-orange-400",
  hn: "text-orange-700 dark:text-orange-300",
  github: "text-gray-700 dark:text-gray-300",
};

export function PlatformIcon({ platform, size = "md" }: { platform: string; size?: "sm" | "md" | "lg" }) {
  const SvgComponent = platformSvgs[platform] || platformSvgs.github;
  const color = platformColors[platform] || platformColors.github;
  const sizeClass = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-10 h-10" : "w-7 h-7";

  return <SvgComponent className={`${sizeClass} ${color}`} />;
}
