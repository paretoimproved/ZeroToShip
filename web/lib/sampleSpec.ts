import type { AgentSpec } from "@/lib/types";

export const sampleAgentSpec: AgentSpec = {
  projectName: "ShipWatch",
  problem:
    "Solo developers and indie hackers juggle multiple projects across GitHub Actions, Vercel, Railway, and Fly.io with no unified dashboard for build status and deploy health.",
  evidence: {
    sourceCount: 12,
    platforms: ["reddit", "hn", "github"],
    signalScore: 87,
    trend: "rising",
  },
  userStories: [
    {
      persona: "Solo developer",
      capability: "connect my GitHub and Vercel accounts in one click",
      outcome:
        "I can see all build statuses in a single dashboard without switching tabs",
      acceptanceCriteria: [
        "OAuth flow completes in under 10 seconds",
        "Dashboard shows builds from all connected providers",
        "Build status updates within 30 seconds of change",
      ],
    },
    {
      persona: "Indie hacker with 3 side projects",
      capability: "get notified immediately when a deploy fails",
      outcome: "I can fix production issues before users notice",
      acceptanceCriteria: [
        "Slack/Discord notification within 60 seconds of failure",
        "Notification includes error summary and link to logs",
        "Configurable alert rules per project",
      ],
    },
    {
      persona: "Small team lead",
      capability: "view deploy frequency and success rates over time",
      outcome:
        "I can identify reliability trends and improve our shipping velocity",
      acceptanceCriteria: [
        "30-day rolling chart of deploys per day",
        "Success rate percentage with trend indicator",
        "Filterable by project and provider",
      ],
    },
  ],
  technicalArchitecture: {
    stack: [
      "Next.js 15 (App Router)",
      "Tailwind CSS",
      "Drizzle ORM + PostgreSQL",
      "Upstash Redis",
    ],
    stackRationale:
      "Next.js for SSR + API routes in one deploy. Drizzle for type-safe DB access. Redis for caching build data and rate limiting provider API calls.",
    databaseSchema: [
      {
        table: "providers",
        keyColumns: ["id", "userId", "type", "accessToken", "connectedAt"],
        relations: "belongs_to users, has_many builds",
      },
      {
        table: "builds",
        keyColumns: [
          "id",
          "providerId",
          "projectName",
          "status",
          "startedAt",
          "duration",
        ],
        relations: "belongs_to providers, has_many build_logs",
      },
      {
        table: "alert_rules",
        keyColumns: ["id", "userId", "projectPattern", "channel", "events"],
        relations: "belongs_to users",
      },
      {
        table: "users",
        keyColumns: ["id", "email", "name", "plan", "createdAt"],
        relations: "has_many providers, has_many alert_rules",
      },
    ],
    apiEndpoints: [
      {
        method: "GET",
        route: "/api/builds",
        purpose: "List builds with filters (project, status, date range)",
      },
      {
        method: "POST",
        route: "/api/providers/connect",
        purpose: "OAuth callback to connect a CI/CD provider",
      },
      {
        method: "GET",
        route: "/api/analytics/deploys",
        purpose: "Deploy frequency and success rate over time",
      },
      {
        method: "POST",
        route: "/api/alerts",
        purpose: "Create or update alert rules",
      },
      {
        method: "GET",
        route: "/api/builds/:id/logs",
        purpose: "Fetch detailed build logs and error output",
      },
      {
        method: "POST",
        route: "/api/webhooks/:provider",
        purpose: "Receive real-time build events from providers",
      },
    ],
    keyComponents:
      "BuildFeed (real-time list), ProviderConnect (OAuth flow), AnalyticsDashboard (charts), AlertRuleEditor (config UI)",
  },
  mvpScope: {
    mustHave: [
      "GitHub Actions + Vercel integration",
      "Real-time build status feed",
      "Email failure alerts",
      "30-day deploy analytics",
    ],
    skipForNow: [
      "AI-powered failure triage",
      "Railway and Fly.io integrations",
      "Team/org features",
      "Mobile PWA",
    ],
  },
  agentInstructions: `# ShipWatch \u2014 CLAUDE.md

## Project Overview
Real-time CI/CD dashboard for solo developers. MVP: GitHub Actions + Vercel.

## Tech Stack
- Next.js 15 (App Router) + Tailwind CSS
- Drizzle ORM + PostgreSQL (Supabase)
- Upstash Redis for caching
- GitHub OAuth + Vercel API

## Key Conventions
- All API routes in \`src/app/api/\`
- Database schema in \`src/db/schema.ts\`
- Provider adapters implement \`ProviderAdapter\` interface
- Use Zod for all request validation
- Never store raw access tokens \u2014 encrypt at rest

## Commands
\`\`\`bash
npm run dev        # Start dev server
npm run db:push    # Push schema changes
npm test           # Run test suite
\`\`\``,
  sources: [
    {
      title: "Ask HN: Best way to monitor multiple CI/CD pipelines?",
      url: "https://news.ycombinator.com/item?id=example1",
      platform: "hn",
      score: 342,
      comments: 89,
    },
    {
      title: "I built a unified CI dashboard \u2014 lessons learned",
      url: "https://reddit.com/r/webdev/example",
      platform: "reddit",
      score: 156,
      comments: 43,
    },
    {
      title: "Feature request: cross-provider build status",
      url: "https://github.com/example/issues/1",
      platform: "github",
      score: 67,
      comments: 21,
    },
  ],
};
