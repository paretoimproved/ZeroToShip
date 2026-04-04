/**
 * Shared test fixtures for ZeroToShip
 *
 * Consolidates duplicated idea brief factories used across test files.
 * Two factory variants exist because the codebase has two IdeaBrief types:
 *   - API/Shared IdeaBrief (generatedAt: string, many optional fields)
 *   - Generation IdeaBrief (generatedAt: Date, all fields required)
 */

import type { IdeaBrief as ApiIdeaBrief } from '../../src/api/config/filters';
import type { IdeaBrief as GenerationIdeaBrief } from '../../src/generation/brief-generator';

// ─── API / Shared IdeaBrief fixtures ─────────────────────────────────────────

/**
 * Create a valid API IdeaBrief with sensible defaults.
 * Used by tests that import IdeaBrief from api/config/filters or api/schemas.
 */
export function makeIdeaBrief(overrides: Partial<ApiIdeaBrief> = {}): ApiIdeaBrief {
  return {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Test Idea',
    tagline: 'A test idea for testing',
    priorityScore: 85.5,
    effortEstimate: 'week',
    revenueEstimate: '$10k-50k/mo',
    category: 'developer-tools',

    problemStatement: 'Developers waste time on repetitive tasks',
    targetAudience: 'Software developers',
    marketSize: '$5B globally',

    existingSolutions: 'Various automation tools',
    gaps: 'No integrated solution',

    proposedSolution: 'An all-in-one automation platform',
    keyFeatures: ['Feature 1', 'Feature 2', 'Feature 3'],
    mvpScope: 'Core automation features',

    technicalSpec: {
      stack: ['TypeScript', 'Node.js', 'PostgreSQL'],
      architecture: 'Microservices',
      estimatedEffort: '2-3 weeks',
    },

    businessModel: {
      pricing: 'Freemium with $19/mo Pro tier',
      revenueProjection: '$10k MRR by month 6',
      monetizationPath: 'SaaS subscriptions',
    },

    goToMarket: {
      launchStrategy: 'ProductHunt launch',
      channels: ['Twitter', 'Reddit', 'HackerNews'],
      firstCustomers: 'Indie hackers',
    },

    risks: ['Competition', 'Market timing'],
    generatedAt: '2026-01-31T10:00:00.000Z',
    ...overrides,
  };
}

/** Default static API IdeaBrief fixture */
export const mockIdea: ApiIdeaBrief = makeIdeaBrief();

// ─── Generation IdeaBrief fixtures ───────────────────────────────────────────

/**
 * Create a valid Generation IdeaBrief with sensible defaults.
 * Used by tests that import IdeaBrief from generation/brief-generator.
 */
export function makeGenerationBrief(overrides: Partial<GenerationIdeaBrief> = {}): GenerationIdeaBrief {
  return {
    id: 'b0000000-0000-0000-0000-000000000001',
    name: 'TestApp',
    tagline: 'A test idea for testing purposes',
    priorityScore: 8.5,
    effortEstimate: 'weekend',
    revenueEstimate: '$10K MRR',

    problemStatement: 'Users struggle with testing email systems',
    targetAudience: 'Developers building email features',
    marketSize: '$1B market',

    existingSolutions: 'Manual testing, expensive tools',
    gaps: 'No simple automated testing solution',

    proposedSolution: 'Automated email testing framework',
    keyFeatures: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'],
    mvpScope: 'Basic email testing with assertions',

    technicalSpec: {
      stack: ['TypeScript', 'Node.js', 'Vitest'],
      architecture: 'Modular testing framework',
      estimatedEffort: 'weekend',
    },

    businessModel: {
      pricing: 'Freemium with Pro tier',
      revenueProjection: '$10K MRR in 6 months',
      monetizationPath: 'Free tier converts to paid',
    },

    goToMarket: {
      launchStrategy: 'Launch on Product Hunt',
      channels: ['Twitter', 'Reddit', 'HN'],
      firstCustomers: 'Indie hackers and startups',
    },

    risks: ['Competition from existing tools', 'Market saturation'],
    sources: [
      {
        platform: 'reddit',
        title: 'Test post title',
        url: 'https://reddit.com/r/test/123',
        score: 100,
        commentCount: 25,
        postedAt: new Date().toISOString(),
      },
    ],
    generatedAt: new Date('2026-01-15T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create an array of Generation IdeaBriefs for batch testing.
 */
export function makeGenerationBriefs(count: number): GenerationIdeaBrief[] {
  return Array.from({ length: count }, (_, i) =>
    makeGenerationBrief({
      id: `b0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      name: `Idea ${i + 1}`,
      tagline: `Tagline for idea ${i + 1}`,
      priorityScore: 10 - i * 0.5,
    })
  );
}
