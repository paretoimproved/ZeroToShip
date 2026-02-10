/**
 * Tests for the Brief Generator Module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Safety net: prevent any real HTTP calls to Anthropic API
const mockFetch = vi.fn().mockRejectedValue(new Error('Real fetch called — test is missing a mock'));
vi.stubGlobal('fetch', mockFetch);

import type { RawPost } from '../../src/scrapers/types';
import type { ProblemCluster } from '../../src/analysis/deduplicator';
import type { ScoredProblem } from '../../src/analysis/scorer';
import type { GapAnalysis } from '../../src/analysis/gap-analyzer';
import {
  generateBrief,
  generateAllBriefs,
  formatBriefMarkdown,
  exportBriefs,
  getBriefStats,
  filterByEffort,
  filterByPriority,
  getQuickWins,
  type IdeaBrief,
} from '../../src/generation/brief-generator';
import {
  buildBriefPrompt,
  parseJsonResponse,
  scoreToEffortLevel,
  effortToString,
  BRIEF_SYSTEM_PROMPT,
} from '../../src/generation/templates';
import {
  detectCategory,
  getRecommendedStack,
  getStacksForEffort,
  formatStackMarkdown,
  WEEKEND_STACKS,
  WEEK_STACKS,
} from '../../src/generation/tech-stacks';
import { makeGenerationBrief } from '../fixtures';

// Helper to create mock posts
function createMockPost(overrides: Partial<RawPost> = {}): RawPost {
  return {
    id: `post_${Math.random().toString(36).slice(2, 8)}`,
    source: 'reddit',
    sourceId: 'abc123',
    title: 'Test post title',
    body: 'Test post body content',
    url: 'https://reddit.com/r/test/123',
    author: 'testuser',
    score: 100,
    commentCount: 25,
    createdAt: new Date(),
    scrapedAt: new Date(),
    signals: [],
    ...overrides,
  };
}

// Helper to create mock clusters
function createMockCluster(overrides: Partial<ProblemCluster> = {}): ProblemCluster {
  return {
    id: `cluster_${Math.random().toString(36).slice(2, 8)}`,
    representativePost: createMockPost(),
    relatedPosts: [],
    frequency: 5,
    totalScore: 250,
    embedding: [],
    problemStatement: 'Users struggle with managing multiple API keys across projects',
    sources: ['reddit', 'hn'],
    ...overrides,
  };
}

// Helper to create scored problems
function createMockScoredProblem(overrides: Partial<ScoredProblem> = {}): ScoredProblem {
  const cluster = createMockCluster(overrides);
  return {
    ...cluster,
    scores: {
      frequency: 5,
      severity: 7,
      marketSize: 6,
      technicalComplexity: 4,
      timeToMvp: 3,
      engagement: 5,
      impact: 210,
      effort: 12,
      priority: 17.5,
    },
    reasoning: {
      severity: 'Moderate pain point affecting daily workflow',
      marketSize: 'Common issue for developers',
      technicalComplexity: 'Standard CRUD app with integrations',
    },
    ...overrides,
  };
}

// Helper to create mock gap analysis
function createMockGapAnalysis(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  return {
    problemId: 'test-problem-id',
    problemStatement: 'Users struggle with managing multiple API keys across projects',
    searchQueries: ['api key management', 'developer secrets'],
    existingSolutions: [
      {
        name: 'Vault',
        url: 'https://vaultproject.io',
        description: 'HashiCorp secret management',
        pricing: 'Free tier + enterprise',
        strengths: ['Enterprise ready', 'Open source'],
        weaknesses: ['Complex setup', 'Overkill for small projects'],
        targetAudience: 'Enterprise teams',
      },
    ],
    gaps: ['No simple solution for indie developers', 'Pricing too high for small teams'],
    marketOpportunity: 'medium',
    differentiationAngles: ['Focus on indie developers', 'Simple CLI-first approach'],
    recommendation: 'VIABLE WITH DIFFERENTIATION: Market has competitors but clear gaps exist.',
    competitionScore: 45,
    analysisNotes: 'Good opportunity for a focused solution',
    analyzedAt: new Date(),
    ...overrides,
  };
}

// Helper to create mock brief
const createMockBrief = (overrides: Partial<IdeaBrief> = {}): IdeaBrief =>
  makeGenerationBrief(overrides);

describe('Tech Stacks', () => {
  describe('detectCategory', () => {
    it('detects developer tools category', () => {
      expect(detectCategory('Building an API testing tool')).toBe('developer-tools');
      expect(detectCategory('CLI for code generation')).toBe('developer-tools');
    });

    it('detects AI/ML category', () => {
      expect(detectCategory('LLM-powered chatbot for support')).toBe('ai-ml');
      expect(detectCategory('ML model to predict churn')).toBe('ai-ml');
    });

    it('detects SaaS category', () => {
      expect(detectCategory('Team dashboard for tracking metrics')).toBe('saas');
      expect(detectCategory('Subscription management tool')).toBe('saas');
    });

    it('detects marketplace category', () => {
      expect(detectCategory('Marketplace for freelance designers')).toBe('marketplace');
      expect(detectCategory('Platform to buy and sell templates')).toBe('marketplace');
    });

    it('defaults to saas for unknown', () => {
      expect(detectCategory('Some random problem')).toBe('saas');
    });
  });

  describe('getRecommendedStack', () => {
    it('returns stack for weekend effort', () => {
      const stack = getRecommendedStack('API testing tool', 'weekend');
      expect(stack).toBeDefined();
      expect(stack.stack.length).toBeGreaterThan(0);
    });

    it('returns stack for week effort', () => {
      const stack = getRecommendedStack('SaaS dashboard', 'week');
      expect(stack).toBeDefined();
    });

    it('returns stack for month effort', () => {
      const stack = getRecommendedStack('Enterprise platform', 'month');
      expect(stack).toBeDefined();
    });

    it('returns stack for quarter effort', () => {
      const stack = getRecommendedStack('Complex marketplace', 'quarter');
      expect(stack).toBeDefined();
    });
  });

  describe('getStacksForEffort', () => {
    it('returns multiple stacks for each effort level', () => {
      expect(getStacksForEffort('weekend').length).toBeGreaterThan(0);
      expect(getStacksForEffort('week').length).toBeGreaterThan(0);
      expect(getStacksForEffort('month').length).toBeGreaterThan(0);
      expect(getStacksForEffort('quarter').length).toBeGreaterThan(0);
    });
  });

  describe('formatStackMarkdown', () => {
    it('formats stack as markdown', () => {
      const stack = WEEKEND_STACKS[0];
      const markdown = formatStackMarkdown(stack);

      expect(markdown).toContain(stack.name);
      expect(markdown).toContain('Stack:');
      expect(markdown).toContain('Architecture:');
      expect(markdown).toContain('Hosting:');
    });
  });
});

describe('Templates', () => {
  describe('BRIEF_SYSTEM_PROMPT', () => {
    it('exists and contains key instructions', () => {
      expect(BRIEF_SYSTEM_PROMPT).toBeDefined();
      expect(BRIEF_SYSTEM_PROMPT).toContain('startup');
      expect(BRIEF_SYSTEM_PROMPT).toContain('JSON');
    });
  });

  describe('buildBriefPrompt', () => {
    it('includes problem data', () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });
      const stack = WEEKEND_STACKS[0];

      const prompt = buildBriefPrompt(problem, gaps, stack, 'weekend');

      expect(prompt).toContain(problem.problemStatement);
      expect(prompt).toContain('Priority Score');
      expect(prompt).toContain('Impact Score');
    });

    it('includes competitive landscape', () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({
        problemId: problem.id,
        marketOpportunity: 'high',
        competitionScore: 30,
      });
      const stack = WEEKEND_STACKS[0];

      const prompt = buildBriefPrompt(problem, gaps, stack, 'weekend');

      expect(prompt).toContain('Market Opportunity');
      expect(prompt).toContain('HIGH');
      expect(prompt).toContain('Competition Score');
    });

    it('includes tech stack recommendation', () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });
      const stack = WEEK_STACKS[0];

      const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

      expect(prompt).toContain('Suggested Tech Stack');
      expect(prompt).toContain(stack.stack[0]);
    });

    it('includes output schema', () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });
      const stack = WEEKEND_STACKS[0];

      const prompt = buildBriefPrompt(problem, gaps, stack, 'weekend');

      expect(prompt).toContain('name');
      expect(prompt).toContain('tagline');
      expect(prompt).toContain('keyFeatures');
      expect(prompt).toContain('risks');
    });
  });

  describe('parseJsonResponse', () => {
    it('parses valid JSON', () => {
      const response = '{"name": "TestApp", "tagline": "A great app"}';
      const parsed = parseJsonResponse<{ name: string; tagline: string }>(response);

      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe('TestApp');
    });

    it('extracts JSON from markdown code blocks', () => {
      const response = '```json\n{"name": "TestApp"}\n```';
      const parsed = parseJsonResponse<{ name: string }>(response);

      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe('TestApp');
    });

    it('extracts JSON from plain code blocks', () => {
      const response = '```\n{"name": "TestApp"}\n```';
      const parsed = parseJsonResponse<{ name: string }>(response);

      expect(parsed).not.toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const response = 'This is not JSON';
      expect(parseJsonResponse(response)).toBeNull();
    });
  });

  describe('scoreToEffortLevel', () => {
    it('returns weekend for low effort', () => {
      expect(scoreToEffortLevel({ timeToMvp: 2, technicalComplexity: 2 })).toBe('weekend');
      expect(scoreToEffortLevel({ timeToMvp: 1, technicalComplexity: 3 })).toBe('weekend');
    });

    it('returns week for medium-low effort', () => {
      expect(scoreToEffortLevel({ timeToMvp: 4, technicalComplexity: 4 })).toBe('week');
      expect(scoreToEffortLevel({ timeToMvp: 3, technicalComplexity: 4 })).toBe('week');
    });

    it('returns month for medium effort', () => {
      expect(scoreToEffortLevel({ timeToMvp: 5, technicalComplexity: 5 })).toBe('month');
      expect(scoreToEffortLevel({ timeToMvp: 6, technicalComplexity: 5 })).toBe('month');
    });

    it('returns quarter for high effort', () => {
      expect(scoreToEffortLevel({ timeToMvp: 7, technicalComplexity: 7 })).toBe('quarter');
      expect(scoreToEffortLevel({ timeToMvp: 10, technicalComplexity: 10 })).toBe('quarter');
    });
  });

  describe('effortToString', () => {
    it('converts effort levels to readable strings', () => {
      expect(effortToString('weekend')).toContain('weekend');
      expect(effortToString('week')).toContain('week');
      expect(effortToString('month')).toContain('month');
      expect(effortToString('quarter')).toContain('quarter');
    });
  });
});

describe('Brief Generator', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('generateBrief', () => {
    it('generates fallback brief without API key', async () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief).toBeDefined();
      expect(brief.id).toMatch(/^brief_/);
      expect(brief.problemStatement).toBe(problem.problemStatement);
      expect(brief.priorityScore).toBe(problem.scores.priority);
    });

    it('includes tech stack in fallback brief', async () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.technicalSpec.stack.length).toBeGreaterThan(0);
      expect(brief.technicalSpec.architecture).toBeDefined();
    });

    it('calculates effort estimate from scores', async () => {
      const problem = createMockScoredProblem({
        scores: {
          frequency: 5,
          severity: 7,
          marketSize: 6,
          technicalComplexity: 2,
          timeToMvp: 2,
          engagement: 5,
          impact: 210,
          effort: 4,
          priority: 52.5,
        },
      });
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.effortEstimate).toBe('weekend');
    });

    it('includes sources from problem posts in fallback brief', async () => {
      const problem = createMockScoredProblem({
        representativePost: createMockPost({ title: 'Main post', score: 200, commentCount: 50 }),
        relatedPosts: [
          createMockPost({ title: 'Related post 1', score: 100, commentCount: 30 }),
          createMockPost({ title: 'Related post 2', score: 50, commentCount: 10 }),
        ],
      });
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.sources).toBeDefined();
      expect(brief.sources.length).toBe(3);
      // Should be sorted by engagement (score + commentCount) descending
      expect(brief.sources[0].title).toBe('Main post');
      expect(brief.sources[0].score).toBe(200);
      expect(brief.sources[1].title).toBe('Related post 1');
      expect(brief.sources[2].title).toBe('Related post 2');
    });

    it('limits sources to top 5 by engagement', async () => {
      const relatedPosts = Array.from({ length: 8 }, (_, i) =>
        createMockPost({ title: `Post ${i}`, score: (8 - i) * 10, commentCount: 5 })
      );
      const problem = createMockScoredProblem({
        representativePost: createMockPost({ title: 'Main', score: 500, commentCount: 100 }),
        relatedPosts,
      });
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.sources.length).toBe(5);
      // First should be highest engagement
      expect(brief.sources[0].title).toBe('Main');
    });

    it('filters out posts with missing URLs', async () => {
      const problem = createMockScoredProblem({
        representativePost: createMockPost({ title: 'Valid post', url: 'https://reddit.com/valid', score: 100, commentCount: 10 }),
        relatedPosts: [
          createMockPost({ title: 'No URL', url: '' as any, score: 200, commentCount: 50 }),
          createMockPost({ title: 'Null URL', url: null as any, score: 300, commentCount: 60 }),
          createMockPost({ title: 'Good post', url: 'https://reddit.com/good', score: 50, commentCount: 5 }),
        ],
      });
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.sources.length).toBe(2);
      expect(brief.sources.every(s => s.url && typeof s.url === 'string')).toBe(true);
      expect(brief.sources[0].title).toBe('Valid post');
      expect(brief.sources[1].title).toBe('Good post');
    });

    it('handles undefined relatedPosts gracefully', async () => {
      const problem = createMockScoredProblem({
        representativePost: createMockPost({ title: 'Solo post', score: 100, commentCount: 10 }),
        relatedPosts: undefined as any,
      });
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.sources.length).toBe(1);
      expect(brief.sources[0].title).toBe('Solo post');
    });

    it('defaults score and commentCount to 0 when missing', async () => {
      const problem = createMockScoredProblem({
        representativePost: createMockPost({ title: 'No metrics', score: undefined as any, commentCount: undefined as any }),
        relatedPosts: [],
      });
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.sources.length).toBe(1);
      expect(brief.sources[0].score).toBe(0);
      expect(brief.sources[0].commentCount).toBe(0);
    });

    it('safely coerces non-Date createdAt values to ISO strings', async () => {
      const isoString = '2026-01-15T12:00:00.000Z';
      const timestamp = new Date('2026-01-15T12:00:00.000Z').getTime();
      const problem = createMockScoredProblem({
        representativePost: createMockPost({ title: 'String date', createdAt: isoString as any, score: 100, commentCount: 10 }),
        relatedPosts: [
          createMockPost({ title: 'Numeric date', createdAt: timestamp as any, score: 50, commentCount: 5 }),
        ],
      });
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.sources.length).toBe(2);
      // Both should produce valid ISO strings
      for (const source of brief.sources) {
        expect(() => new Date(source.postedAt)).not.toThrow();
        expect(new Date(source.postedAt).toISOString()).toBe(source.postedAt);
      }
    });

    it('preserves gap analysis data in fallback', async () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({
        problemId: problem.id,
        existingSolutions: [
          { name: 'Competitor1', url: '', description: '', pricing: '', strengths: [], weaknesses: [], targetAudience: '' },
          { name: 'Competitor2', url: '', description: '', pricing: '', strengths: [], weaknesses: [], targetAudience: '' },
        ],
        gaps: ['Gap 1', 'Gap 2'],
      });

      const brief = await generateBrief(problem, gaps, { anthropicApiKey: '' });

      expect(brief.existingSolutions).toContain('Competitor1');
      expect(brief.existingSolutions).toContain('Competitor2');
      expect(brief.gaps).toContain('Gap 1');
    });
  });

  describe('generateAllBriefs', () => {
    it('returns empty array for empty input', async () => {
      const result = await generateAllBriefs([], new Map());
      expect(result).toEqual([]);
    });

    it('generates briefs for all problems', async () => {
      const problems = [
        createMockScoredProblem({ id: 'p1', problemStatement: 'Problem 1' }),
        createMockScoredProblem({ id: 'p2', problemStatement: 'Problem 2' }),
      ];

      const gapMap = new Map<string, GapAnalysis>();
      gapMap.set('p1', createMockGapAnalysis({ problemId: 'p1' }));
      gapMap.set('p2', createMockGapAnalysis({ problemId: 'p2' }));

      const briefs = await generateAllBriefs(problems, gapMap, { anthropicApiKey: '' });

      expect(briefs.length).toBe(2);
    });

    it('handles missing gap analysis', async () => {
      const problems = [
        createMockScoredProblem({ id: 'p1' }),
      ];

      const briefs = await generateAllBriefs(problems, new Map(), { anthropicApiKey: '' });

      expect(briefs.length).toBe(1);
      expect(briefs[0].gaps).toContain('');
    });

    it('sorts by priority score', async () => {
      const problems = [
        createMockScoredProblem({ id: 'p1', scores: { ...createMockScoredProblem().scores, priority: 10 } }),
        createMockScoredProblem({ id: 'p2', scores: { ...createMockScoredProblem().scores, priority: 30 } }),
        createMockScoredProblem({ id: 'p3', scores: { ...createMockScoredProblem().scores, priority: 20 } }),
      ];

      const gapMap = new Map<string, GapAnalysis>();
      problems.forEach(p => gapMap.set(p.id, createMockGapAnalysis({ problemId: p.id })));

      const briefs = await generateAllBriefs(problems, gapMap, { anthropicApiKey: '' });

      expect(briefs[0].priorityScore).toBe(30);
      expect(briefs[1].priorityScore).toBe(20);
      expect(briefs[2].priorityScore).toBe(10);
    });
  });

  describe('formatBriefMarkdown', () => {
    it('formats brief as markdown', () => {
      const brief = createMockBrief();
      const markdown = formatBriefMarkdown(brief);

      expect(markdown).toContain(`# ${brief.name}`);
      expect(markdown).toContain(brief.tagline);
      expect(markdown).toContain('## Problem');
      expect(markdown).toContain('## Target Audience');
      expect(markdown).toContain('## Technical Specification');
    });

    it('includes all key features', () => {
      const brief = createMockBrief({
        keyFeatures: ['Feature A', 'Feature B', 'Feature C'],
      });
      const markdown = formatBriefMarkdown(brief);

      expect(markdown).toContain('Feature A');
      expect(markdown).toContain('Feature B');
      expect(markdown).toContain('Feature C');
    });

    it('includes all risks', () => {
      const brief = createMockBrief({
        risks: ['Risk 1', 'Risk 2'],
      });
      const markdown = formatBriefMarkdown(brief);

      expect(markdown).toContain('## Risks');
      expect(markdown).toContain('Risk 1');
      expect(markdown).toContain('Risk 2');
    });

    it('includes sources section in markdown', () => {
      const brief = createMockBrief({
        sources: [
          { platform: 'reddit', title: 'A reddit post', url: 'https://reddit.com/r/test', score: 100, commentCount: 25, postedAt: new Date().toISOString() },
          { platform: 'hn', title: 'A HN post', url: 'https://news.ycombinator.com/item?id=1', score: 50, commentCount: 10, postedAt: new Date().toISOString() },
        ],
      });
      const markdown = formatBriefMarkdown(brief);

      expect(markdown).toContain('## Sources');
      expect(markdown).toContain('[reddit] A reddit post');
      expect(markdown).toContain('[hn] A HN post');
      expect(markdown).toContain('100 upvotes');
    });

    it('omits sources section when empty', () => {
      const brief = createMockBrief({ sources: [] });
      const markdown = formatBriefMarkdown(brief);

      expect(markdown).not.toContain('## Sources');
    });

    it('includes generation timestamp', () => {
      const brief = createMockBrief();
      const markdown = formatBriefMarkdown(brief);

      expect(markdown).toContain('Generated:');
    });
  });

  describe('exportBriefs', () => {
    it('exports to valid JSON', () => {
      const briefs = [createMockBrief()];
      const json = exportBriefs(briefs);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe(briefs[0].name);
    });

    it('handles empty array', () => {
      const json = exportBriefs([]);
      expect(JSON.parse(json)).toEqual([]);
    });
  });

  describe('getBriefStats', () => {
    it('calculates stats correctly', () => {
      const briefs = [
        createMockBrief({ effortEstimate: 'weekend', priorityScore: 20 }),
        createMockBrief({ effortEstimate: 'week', priorityScore: 30 }),
        createMockBrief({ effortEstimate: 'weekend', priorityScore: 10 }),
      ];

      const stats = getBriefStats(briefs);

      expect(stats.total).toBe(3);
      expect(stats.byEffort.weekend).toBe(2);
      expect(stats.byEffort.week).toBe(1);
      expect(stats.avgPriorityScore).toBe(20);
    });

    it('returns top ideas', () => {
      const briefs = [
        createMockBrief({ name: 'First', priorityScore: 30 }),
        createMockBrief({ name: 'Second', priorityScore: 20 }),
        createMockBrief({ name: 'Third', priorityScore: 10 }),
      ];

      const stats = getBriefStats(briefs);

      expect(stats.topIdeas.length).toBe(3);
      expect(stats.topIdeas[0].name).toBe('First');
    });

    it('handles empty input', () => {
      const stats = getBriefStats([]);

      expect(stats.total).toBe(0);
      expect(stats.avgPriorityScore).toBe(0);
      expect(stats.topIdeas).toEqual([]);
    });
  });

  describe('filterByEffort', () => {
    it('filters by effort level', () => {
      const briefs = [
        createMockBrief({ effortEstimate: 'weekend' }),
        createMockBrief({ effortEstimate: 'week' }),
        createMockBrief({ effortEstimate: 'weekend' }),
      ];

      const filtered = filterByEffort(briefs, 'weekend');

      expect(filtered.length).toBe(2);
      filtered.forEach(b => expect(b.effortEstimate).toBe('weekend'));
    });
  });

  describe('filterByPriority', () => {
    it('filters by minimum priority', () => {
      const briefs = [
        createMockBrief({ priorityScore: 10 }),
        createMockBrief({ priorityScore: 25 }),
        createMockBrief({ priorityScore: 15 }),
      ];

      const filtered = filterByPriority(briefs, 15);

      expect(filtered.length).toBe(2);
    });
  });

  describe('getQuickWins', () => {
    it('returns weekend and week projects sorted by priority', () => {
      const briefs = [
        createMockBrief({ effortEstimate: 'weekend', priorityScore: 10 }),
        createMockBrief({ effortEstimate: 'month', priorityScore: 50 }),
        createMockBrief({ effortEstimate: 'week', priorityScore: 30 }),
        createMockBrief({ effortEstimate: 'weekend', priorityScore: 20 }),
      ];

      const quickWins = getQuickWins(briefs);

      expect(quickWins.length).toBe(3);
      expect(quickWins[0].priorityScore).toBe(30);
      expect(quickWins[1].priorityScore).toBe(20);
      expect(quickWins[2].priorityScore).toBe(10);
    });

    it('excludes month and quarter projects', () => {
      const briefs = [
        createMockBrief({ effortEstimate: 'month' }),
        createMockBrief({ effortEstimate: 'quarter' }),
      ];

      const quickWins = getQuickWins(briefs);

      expect(quickWins.length).toBe(0);
    });
  });

  describe('Tiered Model Selection', () => {
    it('accepts userTier parameter in config', async () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      // Should not throw when passing userTier
      const brief = await generateBrief(problem, gaps, {
        userTier: 'enterprise',
      });

      expect(brief).toBeDefined();
      expect(brief.id).toMatch(/^brief_/);
    });

    it('defaults to pro tier when userTier not specified', async () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      // Should work with default tier
      const brief = await generateBrief(problem, gaps, {});

      expect(brief).toBeDefined();
    });

    it('accepts all valid tier values', async () => {
      const problem = createMockScoredProblem();
      const gaps = createMockGapAnalysis({ problemId: problem.id });

      const tiers: Array<'free' | 'pro' | 'enterprise'> = ['free', 'pro', 'enterprise'];

      for (const tier of tiers) {
        const brief = await generateBrief(problem, gaps, { userTier: tier });
        expect(brief).toBeDefined();
      }
    });

    it('generateAllBriefs accepts userTier parameter', async () => {
      const problems = [
        createMockScoredProblem({ id: 'p1', problemStatement: 'Problem 1' }),
      ];

      const gapMap = new Map<string, GapAnalysis>();
      gapMap.set('p1', createMockGapAnalysis({ problemId: 'p1' }));

      const briefs = await generateAllBriefs(problems, gapMap, {
        userTier: 'enterprise',
      });

      expect(briefs.length).toBe(1);
    });
  });
});
