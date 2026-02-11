export function PlatformIcon({ platform }: { platform: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    reddit: { label: "R", bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-600 dark:text-orange-400" },
    hn: { label: "Y", bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-700 dark:text-orange-300" },
    github: { label: "G", bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-800 dark:text-gray-200" },
  };
  const { label, bg, text } = config[platform] || config.github;
  return (
    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
      <span className={`text-sm font-bold ${text}`}>{label}</span>
    </div>
  );
}
