export default function IdeaLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pt-28">
      {/* Back link skeleton */}
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-6 animate-pulse" />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-pulse">
        {/* Header skeleton */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          </div>
        </div>
        {/* Tab bar skeleton */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 gap-4">
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded my-3" />
          ))}
        </div>
        {/* Panel skeleton */}
        <div className="p-6 space-y-4">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-6" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
        </div>
      </div>
    </main>
  );
}
