export function MonoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-2 py-1 rounded">
      {children}
    </span>
  );
}
