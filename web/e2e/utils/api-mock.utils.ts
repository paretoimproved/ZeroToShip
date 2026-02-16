/**
 * API mocking utilities for E2E tests
 */

import { Page, Route } from '@playwright/test';
import { API_URL, SEED_IDEAS, TIER_LIMITS, UserTier } from './test-data';

export interface MockIdea {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: string;
  revenueEstimate: string;
  problemStatement: string;
  targetAudience: string;
  marketSize: string;
  existingSolutions: string;
  gaps: string;
  proposedSolution: string;
  keyFeatures: string[];
  mvpScope: string;
  technicalSpec: {
    stack: string[];
    architecture: string;
    estimatedEffort: string;
  };
  businessModel: {
    pricing: string;
    revenueProjection: string;
    monetizationPath: string;
  };
  goToMarket: {
    launchStrategy: string;
    channels: string[];
    firstCustomers: string;
  };
  risks: string[];
  sources?: Array<{
    platform: "reddit" | "hn" | "twitter" | "github";
    title: string;
    url: string;
    score: number;
    commentCount: number;
    postedAt: string;
  }>;
  generatedAt: string;
}

/**
 * Generate mock ideas based on seed data
 */
export function generateMockIdeas(count: number = SEED_IDEAS.length): MockIdea[] {
  return SEED_IDEAS.slice(0, count).map((seed, index) => ({
    id: `mock-${index + 1}`,
    name: seed.name,
    tagline: `Tagline for ${seed.name}`,
    priorityScore: seed.score,
    effortEstimate: seed.effort,
    revenueEstimate: '$5K-20K per month',
    problemStatement: `Problem statement for ${seed.name}`,
    targetAudience: 'Developers and indie hackers',
    marketSize: '$1B+ market',
    existingSolutions: 'Various existing solutions',
    gaps: 'Market gaps description',
    proposedSolution: `Solution for ${seed.name}`,
    keyFeatures: ['Feature 1', 'Feature 2', 'Feature 3'],
    mvpScope: 'Core features for launch',
    technicalSpec: {
      stack: ['Next.js', 'PostgreSQL', 'Redis'],
      architecture: 'Serverless',
      estimatedEffort: seed.effort,
    },
    businessModel: {
      pricing: '$9-29/mo',
      revenueProjection: '$10K per month',
      monetizationPath: 'Freemium',
    },
    goToMarket: {
      launchStrategy: 'Product Hunt launch',
      channels: ['Reddit', 'Indie Hackers', 'Hacker News'],
      firstCustomers: 'Early adopters',
    },
    risks: ['Competition', 'Market changes'],
    sources: [
      {
        platform: "reddit",
        title: `${seed.name}: pain point thread`,
        url: "https://reddit.com/r/startups/example",
        score: 234,
        commentCount: 89,
        postedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      },
      {
        platform: "hn",
        title: `Ask HN: ${seed.name} alternatives?`,
        url: "https://news.ycombinator.com/item?id=12345678",
        score: 156,
        commentCount: 67,
        postedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      },
      {
        platform: "github",
        title: `${seed.name}: issue backlog`,
        url: "https://github.com/example/repo/issues/1",
        score: 42,
        commentCount: 12,
        postedAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
      },
    ],
    generatedAt: new Date().toISOString(),
  }));
}

function tierToPlan(tier: UserTier): 'free' | 'pro' | 'enterprise' {
  if (tier === 'enterprise') return 'enterprise';
  if (tier === 'pro') return 'pro';
  return 'free';
}

function buildMockUser(
  tier: UserTier,
  emailFrequency: 'daily' | 'weekly' | 'never' = 'daily'
) {
  const plan = tierToPlan(tier);
  const capitalized = plan.charAt(0).toUpperCase() + plan.slice(1);
  return {
    id: `${plan}-user-123`,
    email: `${plan}@test.zerotoship.dev`,
    name: `${capitalized} User`,
    tier: plan,
    isAdmin: false,
    preferences: {
      emailFrequency,
    },
  };
}

/**
 * Setup API mocking for auth/me endpoint.
 * Anonymous users get 401; authenticated tiers get a valid profile.
 */
export async function mockAuthMeApi(
  page: Page,
  tier: UserTier = 'anonymous'
): Promise<void> {
  await page.route(`${API_URL}/auth/me`, async (route: Route) => {
    if (tier === 'anonymous') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildMockUser(tier)),
    });
  });
}

/**
 * Setup API mocking for updating user preferences.
 */
export async function mockUserPreferencesApi(
  page: Page,
  tier: Exclude<UserTier, 'anonymous'> = 'free'
): Promise<void> {
  let emailFrequency: 'daily' | 'weekly' | 'never' = 'daily';

  await page.route(`${API_URL}/user/preferences`, async (route: Route) => {
    const method = route.request().method();

    if (method === 'PUT' || method === 'PATCH') {
      const payload = route.request().postDataJSON() as
        | { emailFrequency?: 'daily' | 'weekly' | 'never' }
        | undefined;
      if (payload?.emailFrequency) {
        emailFrequency = payload.emailFrequency;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildMockUser(tier, emailFrequency)),
    });
  });
}

/**
 * Setup API mocking for saved ideas/bookmarks.
 */
export async function mockSavedIdeasApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/ideas/saved`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

/**
 * Setup API mocking for the ideas endpoint
 */
export async function mockIdeasApi(page: Page, tier: UserTier = 'anonymous'): Promise<void> {
  const limit = TIER_LIMITS[tier].ideasVisible;
  const ideas = generateMockIdeas(Math.min(limit, SEED_IDEAS.length));

  await page.route(`${API_URL}/ideas/today`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ideas,
        total: SEED_IDEAS.length,
        limit,
        tier,
      }),
    });
  });
}

/**
 * Setup API mocking for a single idea endpoint.
 * When called without ideaId, uses a glob to match any mock idea ID.
 */
export async function mockIdeaDetailApi(page: Page, ideaId?: string): Promise<void> {
  const mockIdeas = generateMockIdeas();

  if (ideaId) {
    const idea = mockIdeas.find((i) => i.id === ideaId) || mockIdeas[0];

    await page.route(`${API_URL}/ideas/${ideaId}`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(idea),
      });
    });
  } else {
    // Wildcard: match any idea detail request by mock ID
    await page.route(`${API_URL}/ideas/mock-*`, async (route: Route) => {
      const url = route.request().url();
      const requestedId = url.split('/').pop() || '';
      const idea = mockIdeas.find((i) => i.id === requestedId) || mockIdeas[0];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(idea),
      });
    });
  }
}

/**
 * Setup API mocking for the archive endpoint
 */
export async function mockArchiveApi(
  page: Page,
  options: { page?: number; pageSize?: number; tier?: UserTier } = {}
): Promise<void> {
  const { page: pageNum = 1, pageSize = 10, tier = 'anonymous' } = options;
  const ideas = generateMockIdeas();

  await page.route(`${API_URL}/ideas/archive*`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: ideas.slice(0, pageSize),
        total: ideas.length,
        page: pageNum,
        pageSize,
        hasMore: ideas.length > pageNum * pageSize,
      }),
    });
  });
}

/**
 * Setup API mocking for user subscription endpoint
 */
export async function mockSubscriptionApi(
  page: Page,
  plan: 'free' | 'pro' | 'enterprise' = 'free'
): Promise<void> {
  await page.route(`${API_URL}/user/subscription`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'sub_mock123',
        userId: 'user_mock123',
        plan,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      }),
    });
  });
}

/**
 * Setup API mocking for the billing checkout endpoint
 */
export async function mockBillingCheckoutApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/billing/checkout`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://checkout.example.com/mock-session',
          sessionId: 'cs_mock_session_123',
        }),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Setup API mocking for the billing portal endpoint
 */
export async function mockBillingPortalApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/billing/portal`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://billing.example.com/mock-portal',
        }),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Setup API mocking for the billing prices endpoint
 */
export async function mockBillingPricesApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/billing/prices`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        prices: [
          {
            key: 'pro_monthly',
            priceId: 'price_mock_pro_monthly',
            amount: 1900,
            currency: 'usd',
            interval: 'month',
            tier: 'pro',
          },
          {
            key: 'pro_yearly',
            priceId: 'price_mock_pro_yearly',
            amount: 19000,
            currency: 'usd',
            interval: 'year',
            tier: 'pro',
          },
          {
            key: 'enterprise_monthly',
            priceId: 'price_mock_enterprise_monthly',
            amount: 9900,
            currency: 'usd',
            interval: 'month',
            tier: 'enterprise',
          },
          {
            key: 'enterprise_yearly',
            priceId: 'price_mock_enterprise_yearly',
            amount: 99000,
            currency: 'usd',
            interval: 'year',
            tier: 'enterprise',
          },
        ],
      }),
    });
  });
}

/**
 * Setup API mocking for the admin auth/me endpoint (returns isAdmin: true)
 */
export async function mockAdminAuthMe(
  page: Page,
  tier: 'free' | 'pro' | 'enterprise' = 'enterprise'
): Promise<void> {
  await page.route(`${API_URL}/auth/me`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'admin-user-123',
        email: 'admin@zerotoship.dev',
        name: 'Admin User',
        tier,
        isAdmin: true,
      }),
    });
  });
}

/**
 * Setup API mocking for admin stats overview
 */
export async function mockAdminStatsApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/admin/stats/overview`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalUsers: 142,
        activeSubscribers: 38,
        totalIdeas: 1250,
        ideasToday: 7,
        pipeline: {
          lastRunId: 'run_20260208_abc123',
          lastRunAt: new Date().toISOString(),
        },
      }),
    });
  });
}

/**
 * Setup API mocking for admin system health
 */
export async function mockAdminSystemHealthApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/admin/system-health`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        pipeline: {
          lastRunId: 'run_20260208_abc123',
          lastRunAt: new Date().toISOString(),
          lastRunPhases: {
            scrape: 'completed',
            analyze: 'completed',
            generate: 'completed',
            deliver: 'completed',
          },
        },
        counts: { activeSubscribers: 38, totalIdeas: 1250 },
        uptime: 86400,
        timestamp: new Date().toISOString(),
      }),
    });
  });
}

/**
 * Setup API mocking for admin pipeline status
 */
export async function mockAdminPipelineStatusApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/admin/pipeline-status`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        runId: 'run_20260208_abc123',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        phases: {
          scrape: 'completed',
          analyze: 'completed',
          generate: 'completed',
          deliver: 'completed',
        },
        lastCompletedPhase: 'deliver',
        updatedAt: new Date().toISOString(),
      }),
    });
  });
}

/**
 * Setup API mocking for admin pipeline trigger
 */
export async function mockAdminPipelineRunApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/admin/pipeline/run`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'started',
          message: 'Pipeline run started',
          // Keep shape aligned with the real API and the admin UI, which expects `runId`.
          runId: 'run_20260214_openclaw_demo',
          config: { hoursBack: 24, maxBriefs: 10, dryRun: false },
        }),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Setup API mocking for admin users list
 */
export async function mockAdminUsersApi(page: Page): Promise<void> {
  await page.route(`${API_URL}/admin/users`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          {
            id: 'user-1',
            email: 'admin@zerotoship.dev',
            name: 'Admin User',
            tier: 'enterprise',
            createdAt: '2026-01-15T00:00:00Z',
          },
          {
            id: 'user-2',
            email: 'pro@example.com',
            name: 'Pro User',
            tier: 'pro',
            createdAt: '2026-01-20T00:00:00Z',
          },
          {
            id: 'user-3',
            email: 'free@example.com',
            name: 'Free User',
            tier: 'free',
            createdAt: '2026-02-01T00:00:00Z',
          },
        ],
      }),
    });
  });
}

/**
 * Setup API mocking for admin runs list.
 */
export async function mockAdminRunsApi(
  page: Page,
  runs: unknown[],
  options: { page?: number; limit?: number; total?: number } = {},
): Promise<void> {
  const pageNum = options.page ?? 1;
  const limit = options.limit ?? 20;
  const total = options.total ?? runs.length;

  // Match only the list endpoint (/admin/runs[?query...]) but NOT /admin/runs/:runId.
  const listRe = new RegExp(`${API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/admin/runs(?:\\?.*)?$`);

  await page.route(listRe, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runs,
        total,
        page: pageNum,
        limit,
      }),
    });
  });
}

/**
 * Setup API mocking for admin run detail.
 */
export async function mockAdminRunDetailApi(
  page: Page,
  runId: string,
  run: unknown,
): Promise<void> {
  await page.route(`${API_URL}/admin/runs/${runId}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ run }),
    });
  });
}

/**
 * Setup all admin API mocks
 */
export async function setupAdminApiMocks(page: Page): Promise<void> {
  await mockAdminAuthMe(page);
  await mockAdminStatsApi(page);
  await mockAdminSystemHealthApi(page);
  await mockAdminPipelineStatusApi(page);
  await mockAdminPipelineRunApi(page);
  await mockAdminUsersApi(page);
}

/**
 * Setup all common API mocks
 */
export async function setupAllApiMocks(
  page: Page,
  tier: UserTier = 'anonymous'
): Promise<void> {
  if (tier === 'anonymous') {
    await mockAuthMeApi(page, tier);
  } else {
    let emailFrequency: 'daily' | 'weekly' | 'never' = 'daily';

    await page.route(`${API_URL}/auth/me`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockUser(tier, emailFrequency)),
      });
    });

    await page.route(`${API_URL}/user/preferences`, async (route: Route) => {
      const method = route.request().method();
      if (method === 'PUT' || method === 'PATCH') {
        const payload = route.request().postDataJSON() as
          | { emailFrequency?: 'daily' | 'weekly' | 'never' }
          | undefined;
        if (payload?.emailFrequency) {
          emailFrequency = payload.emailFrequency;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockUser(tier, emailFrequency)),
      });
    });
  }

  await mockIdeaDetailApi(page);
  await mockIdeasApi(page, tier);
  await mockArchiveApi(page, { tier });

  if (tier !== 'anonymous') {
    const plan = tierToPlan(tier);
    await mockSavedIdeasApi(page);
    await mockSubscriptionApi(page, plan);
    await mockBillingCheckoutApi(page);
    await mockBillingPortalApi(page);
    await mockBillingPricesApi(page);
  }
}
