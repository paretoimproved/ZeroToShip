import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/archive", "/explore", "/idea/"],
        disallow: ["/admin/", "/dashboard", "/settings", "/account"],
      },
    ],
    sitemap: "https://zerotoship.dev/sitemap.xml",
  };
}
