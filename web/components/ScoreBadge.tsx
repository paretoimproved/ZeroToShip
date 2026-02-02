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
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${getScoreColor(score)} ${sizeClasses[size]}`}
    >
      {score.toFixed(0)}
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
      label: "Weekend",
      color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    },
    week: {
      label: "1 Week",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    month: {
      label: "1 Month",
      color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    },
    quarter: {
      label: "Quarter+",
      color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const config = effortConfig[effort];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}

export default ScoreBadge;
