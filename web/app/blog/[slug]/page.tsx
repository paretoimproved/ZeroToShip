import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts, getPostBySlug, getAllSlugs } from "../posts";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found - ZeroToShip" };
  }

  return {
    title: `${post.metaTitle} - ZeroToShip`,
    description: post.description,
    openGraph: {
      title: post.metaTitle,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.description,
    },
  };
}

function ArticleJsonLd({ post }: { post: (typeof blogPosts)[number] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: "ZeroToShip",
      url: "https://zerotoship.dev",
    },
    publisher: {
      "@type": "Organization",
      name: "ZeroToShip",
      url: "https://zerotoship.dev",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://zerotoship.dev/blog/${post.slug}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <ArticleJsonLd post={post} />

      <article className="min-h-screen bg-white dark:bg-gray-900 pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to blog
          </Link>

          {/* Header */}
          <header className="mt-6">
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

            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {post.title}
            </h1>

            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-full bg-primary-50 dark:bg-primary-900/30 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          {/* Content */}
          <div
            className="mt-10 prose prose-gray dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Bottom CTA */}
          <div className="mt-16 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 sm:p-8 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              Get startup ideas delivered daily
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              ZeroToShip scrapes 300+ posts from Reddit, Hacker News, and GitHub every
              day and delivers 10 scored ideas with full business briefs.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-block rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              Start Free
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
