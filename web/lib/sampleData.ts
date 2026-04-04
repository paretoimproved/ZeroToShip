import type { IdeaBrief } from "@/lib/types";

export const sampleBrief: IdeaBrief = {
  id: "sample-ci-dashboard",
  name: "ShipWatch",
  tagline: "A real-time CI/CD dashboard built for solo developers and small teams.",
  priorityScore: 87,
  effortEstimate: "week",
  revenueEstimate: "$8K–$15K per month within 12 months",

  problemStatement:
    "Solo developers and indie hackers juggle multiple projects across GitHub Actions, Vercel, Railway, and Fly.io. There is no single pane of glass that aggregates build status, deploy health, and failure alerts across all of these providers without enterprise-grade complexity or pricing. Developers waste 20+ minutes per day context-switching between dashboards just to check if their deploys succeeded.",

  targetAudience:
    "Indie hackers, solo founders, and small dev teams (1–5 people) shipping side projects or early-stage SaaS products. They use multiple CI/CD providers and want a lightweight, opinionated dashboard rather than a full DevOps platform.",

  marketSize:
    "There are approximately 4.2M active GitHub users with CI/CD pipelines. The solo/small-team developer tools market is valued at $2.1B (2025) and growing at 18% CAGR. The addressable segment for lightweight CI dashboards is estimated at $120M–$180M.",

  existingSolutions:
    "GitHub Actions dashboard (limited to GitHub only), Vercel dashboard (limited to Vercel only), Datadog CI Visibility (enterprise pricing, $23/user/mo minimum), BuildPulse (focused on flaky test detection), and custom Grafana setups (require significant maintenance overhead).",

  gaps:
    "No existing solution offers a unified, multi-provider CI/CD view at indie-hacker-friendly pricing ($0–$19/mo). Current tools are either vendor-locked to one provider, priced for enterprises, or require extensive self-hosting and configuration. None provide AI-powered failure triage or natural-language build summaries.",

  proposedSolution:
    "A lightweight web dashboard that connects to GitHub Actions, GitLab CI, Vercel, Railway, Fly.io, and Netlify via API tokens. It provides a unified feed of builds and deploys with real-time status, failure grouping, and AI-generated root-cause summaries for failed builds. Notifications are sent via Slack, Discord, or email.",

  keyFeatures: [
    "Unified multi-provider build feed with real-time WebSocket updates",
    "AI-powered failure triage that groups errors and suggests fixes",
    "One-click connect via OAuth for GitHub, GitLab, Vercel, and Railway",
    "Slack and Discord notifications with configurable alert rules",
    "Deploy frequency and success-rate analytics per project",
    "Mobile-responsive PWA for checking builds on the go",
  ],

  mvpScope:
    "GitHub Actions + Vercel integration only. Real-time build status feed, failure alerts via email, and a simple analytics page showing deploy frequency and success rate over the last 30 days. No AI triage in MVP — just structured error logs. Ship in one week.",

  technicalSpec: {
    stack: [
      "Next.js 15 (App Router)",
      "Tailwind CSS",
      "Drizzle ORM + PostgreSQL",
      "Upstash Redis (caching & rate limiting)",
      "GitHub OAuth + API",
      "Vercel REST API",
      "Resend (transactional email)",
    ],
    architecture:
      "Serverless Next.js app on Vercel. Background polling via Vercel Cron (every 2 minutes) fetches build statuses from connected providers and writes to PostgreSQL. WebSocket connections via Ably for real-time dashboard updates. Redis caches recent build data to reduce API calls. All provider integrations use a common adapter interface for easy extension.",
    estimatedEffort:
      "MVP: 5–7 days for a senior full-stack developer. Full product with AI triage and 6 providers: 6–8 weeks.",
  },

  businessModel: {
    pricing:
      "Free tier for individual developers: 2 connected repos, 7-day history. Pro ($9/mo): unlimited repos, 90-day history, shared dashboards and priority alerting. Team ($19/mo per seat): role-based access and org-wide visibility.",
    revenueProjection:
      "Month 3: 200 developers using the dashboard. Month 6: first paid team accounts, 800 active users. Month 12: 2,500 developers, 80 teams onboarded. Break-even at ~60 Pro accounts.",
    monetizationPath:
      "Launch with a generous free tier to drive adoption. Add Pro tier for power users needing longer history and integrations. Introduce Team tier for orgs. Expand provider adapter ecosystem via community contributions. Long-term: become the default CI/CD observability layer for small teams.",
  },

  goToMarket: {
    launchStrategy:
      "Launch on Product Hunt as a 'Developer Tools' product. Post on Hacker News (Show HN) with a focus on the technical architecture. Submit to Indie Hackers and dev tool newsletters (TLDR, Bytes, Console.dev).",
    channels: [
      "Product Hunt launch",
      "Hacker News Show HN",
      "Indie Hackers community post",
      "Dev tool newsletters (TLDR, Bytes, Console.dev)",
      "Reddit r/selfhosted and r/webdev",
    ],
    firstCustomers:
      "Target 50 beta users from Indie Hackers community and Reddit. Offer lifetime Pro access to first 20 beta signups in exchange for detailed feedback and testimonials. Partner with 2–3 dev tool YouTubers for early reviews.",
  },

  risks: [
    "API rate limits from CI/CD providers could throttle polling for power users with many repos",
    "GitHub and Vercel could ship their own unified dashboards, reducing the value proposition",
    "Free-to-Pro conversion may be lower than projected if the free tier is too generous",
    "Real-time WebSocket infrastructure costs could scale faster than revenue at high user counts",
    "Provider API changes could break integrations without warning, requiring ongoing maintenance",
  ],

  generatedAt: "2026-02-08T06:00:00.000Z",
};
