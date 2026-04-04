const SIZES = {
  sm: { icon: 24, text: "text-base" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 48, text: "text-3xl" },
} as const;

interface LogoProps {
  variant?: "icon" | "wordmark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

function LogoIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Origin dot — "zero" */}
      <circle cx="6" cy="26" r="3" fill="#6366f1" />
      {/* Trajectory line — diagonal path */}
      <line
        x1="8"
        y1="24"
        x2="22"
        y2="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Arrowhead — "ship" */}
      <path
        d="M19 6 L26 6 L26 13"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function Logo({
  variant = "wordmark",
  size = "md",
  className = "",
}: LogoProps) {
  const { icon, text } = SIZES[size];

  if (variant === "icon") {
    return (
      <span className={`inline-flex ${className}`}>
        <LogoIcon size={icon} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoIcon size={icon} />
      <span className={`${text} font-bold tracking-tight`}>ZeroToShip</span>
    </span>
  );
}
