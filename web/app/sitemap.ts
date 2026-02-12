import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
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

  // TODO: Add dynamic idea routes by fetching published ideas from the API
  // Example:
  // const ideas = await db.select({ id: ideasTable.id, updatedAt: ideasTable.updatedAt }).from(ideasTable);
  // const ideaRoutes = ideas.map((idea) => ({
  //   url: `${baseUrl}/idea/${idea.id}`,
  //   lastModified: idea.updatedAt,
  //   changeFrequency: "weekly" as const,
  //   priority: 0.6,
  // }));

  return [...staticRoutes];
}
