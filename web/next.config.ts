import type { NextConfig } from "next";

// Extract just the origin (scheme + host + port) from the API URL for CSP.
// CSP path matching without a trailing slash requires an EXACT match, so
// "https://api.example.com/api/v1" would block "/api/v1/auth/me".
// Using the origin alone allows all subpaths.
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
let apiOrigin: string;
try {
  apiOrigin = new URL(apiUrl).origin;
} catch {
  apiOrigin = apiUrl;
}
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://accounts.google.com " +
                apiOrigin + (posthogHost ? " " + posthogHost : ""),
              "frame-src 'self' https://accounts.google.com https://js.stripe.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
