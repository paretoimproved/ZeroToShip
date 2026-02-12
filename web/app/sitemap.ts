import type { MetadataRoute } from "next";
import { blogPosts } from "./blog/posts";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://zerotoship.dev";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  const contentRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  let ideaRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_BASE_URL}/ideas/archive?pageSize=500`, {
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const data = await res.json();
      const ideas: Array<{ id: string; generatedAt?: string; publishedAt?: string }> =
        data.data || data.ideas || [];
      ideaRoutes = ideas.map((idea) => ({
        url: `${baseUrl}/idea/${idea.id}`,
        lastModified: new Date(idea.generatedAt || idea.publishedAt || new Date().toISOString()),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch {
    /* sitemap still works without dynamic routes */
  }

  return [...staticRoutes, ...contentRoutes, ...blogRoutes, ...ideaRoutes];
}
