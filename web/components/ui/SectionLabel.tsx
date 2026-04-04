export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-1">
      {children}
    </dt>
  );
}
