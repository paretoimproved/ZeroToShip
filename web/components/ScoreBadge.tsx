import type { EffortLevel } from "@/lib/types";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 60) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const rounded = Math.round(score);
  const label = size === "sm" ? `Score ${rounded}/100` : `Opportunity score ${rounded}/100`;

  return (
    <span
      title="Opportunity score (0–100). Higher = better opportunity vs effort."
      aria-label={label}
      className={`inline-flex items-center font-semibold rounded-full shadow-sm transition-colors duration-200 ${getScoreColor(score)} ${sizeClasses[size]}`}
    >
      {`Score ${rounded}/100`}
    </span>
  );
}

interface EffortBadgeProps {
  effort: EffortLevel;
  size?: "sm" | "md" | "lg";
}

export function EffortBadge({ effort, size = "md" }: EffortBadgeProps) {
  const effortConfig: Record<EffortLevel, { label: string; color: string }> = {
    weekend: {
      label: "Build: Weekend",
      color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    },
    week: {
      label: "Build: 1 Week",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    month: {
      label: "Build: 1 Month",
      color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    },
    quarter: {
      label: "Build: Quarter+",
      color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  };

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const config = effortConfig[effort];

  return (
    <span
      title="Rough time estimate to build a basic MVP."
      aria-label={`Estimated build time: ${config.label.replace(/^Build:\s*/i, "")}`}
      className={`inline-flex items-center font-medium rounded-full shadow-sm transition-colors duration-200 ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}

interface EvidenceStrengthBadgeProps {
  evidenceStrength?: 'strong' | 'moderate' | 'weak';
  size?: "sm" | "md" | "lg";
}

export function EvidenceStrengthBadge({ evidenceStrength, size = "md" }: EvidenceStrengthBadgeProps) {
  if (!evidenceStrength) return null;

  const config: Record<string, { label: string; color: string }> = {
    strong: {
      label: "Strong Signal",
      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    moderate: {
      label: "Moderate Signal",
      color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    },
    weak: {
      label: "Needs Validation",
      color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    },
  };

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const { label, color } = config[evidenceStrength];

  return (
    <span
      title="Evidence strength based on source count, engagement, and platform diversity."
      aria-label={`Evidence strength: ${label}`}
      className={`inline-flex items-center font-medium rounded-full shadow-sm transition-colors duration-200 ${color} ${sizeClasses[size]}`}
    >
      {label}
    </span>
  );
}

export default ScoreBadge;
