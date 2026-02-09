export function PillBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs px-2 py-1 rounded-full">
      {children}
    </span>
  );
}
