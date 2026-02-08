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
    revenueEstimate: '$5K-20K MRR',
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
      revenueProjection: '$10K MRR',
      monetizationPath: 'Freemium',
    },
    goToMarket: {
      launchStrategy: 'Product Hunt launch',
      channels: ['Twitter', 'Reddit', 'Indie Hackers'],
      firstCustomers: 'Early adopters',
    },
    risks: ['Competition', 'Market changes'],
    generatedAt: new Date().toISOString(),
  }));
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
 * Setup all common API mocks
 */
export async function setupAllApiMocks(
  page: Page,
  tier: UserTier = 'anonymous'
): Promise<void> {
  await mockIdeaDetailApi(page);
  await mockIdeasApi(page, tier);
  await mockArchiveApi(page, { tier });

  if (tier !== 'anonymous') {
    const plan = tier === 'free' ? 'free' : tier === 'pro' ? 'pro' : 'enterprise';
    await mockSubscriptionApi(page, plan);
    await mockBillingCheckoutApi(page);
    await mockBillingPortalApi(page);
    await mockBillingPricesApi(page);
  }
}
