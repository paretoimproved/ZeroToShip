import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "./posts";

export const metadata: Metadata = {
  title: "Blog - ZeroToShip",
  description:
    "Insights on finding, validating, and building startup ideas. Practical advice for founders who want to ship, not guess.",
  openGraph: {
    title: "Blog - ZeroToShip",
    description:
      "Insights on finding, validating, and building startup ideas. Practical advice for founders who want to ship, not guess.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog - ZeroToShip",
    description:
      "Insights on finding, validating, and building startup ideas.",
  },
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
          Blog
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
          Practical advice on finding, validating, and building startup ideas.
        </p>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 transition-colors hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span aria-hidden="true">&middot;</span>
                <span>{post.readingTime}</span>
              </div>

              <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {post.title}
              </h2>

              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                {post.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded-full bg-primary-50 dark:bg-primary-900/30 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
