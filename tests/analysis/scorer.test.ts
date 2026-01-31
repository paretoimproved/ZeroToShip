/**
 * Tests for the Problem Scoring Module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawPost } from '../../src/scrapers/types';
import type { ProblemCluster } from '../../src/analysis/deduplicator';
import {
  scoreProblem,
  scoreAll,
  getScoringStats,
  exportScoredProblems,
  filterByPriority,
  filterByEffort,
  getWeekendProjects,
  type ScoredProblem,
} from '../../src/analysis/scorer';
import {
  buildScoringPrompt,
  parseScoreResponse,
  createDefaultScores,
  SCORING_SYSTEM_PROMPT,
} from '../../src/analysis/score-prompts';

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
  const cluster = createMockCluster();
  return {
    ...cluster,
    scores: {
      frequency: 5,
      severity: 7,
      marketSize: 6,
      technicalComplexity: 4,
      timeToMvp: 3,
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

describe('Score Prompts', () => {
  describe('buildScoringPrompt', () => {
    it('includes problem statement', () => {
      const cluster = createMockCluster({
        problemStatement: 'Users need better API key management',
      });
      const prompt = buildScoringPrompt(cluster);
      expect(prompt).toContain('Users need better API key management');
    });

    it('includes frequency and sources', () => {
      const cluster = createMockCluster({
        frequency: 12,
        sources: ['reddit', 'hn', 'twitter'],
      });
      const prompt = buildScoringPrompt(cluster);
      expect(prompt).toContain('12 times');
      expect(prompt).toContain('reddit, hn, twitter');
    });

    it('includes sample posts', () => {
      const cluster = createMockCluster({
        representativePost: createMockPost({ title: 'Main problem post' }),
        relatedPosts: [
          createMockPost({ title: 'Related post 1', source: 'hn' }),
          createMockPost({ title: 'Related post 2', source: 'twitter' }),
        ],
      });
      const prompt = buildScoringPrompt(cluster);
      expect(prompt).toContain('Main problem post');
      expect(prompt).toContain('Related post 1');
    });

    it('limits sample posts to 3', () => {
      const cluster = createMockCluster({
        relatedPosts: Array(10).fill(null).map((_, i) =>
          createMockPost({ title: `UniquePostTitle${i}` })
        ),
      });
      const prompt = buildScoringPrompt(cluster);
      // Count how many of our unique post titles appear in the prompt
      const matches = prompt.match(/UniquePostTitle\d/g) || [];
      // Should have max 3 posts (representative + 2 related due to maxPosts=3 in formatSamplePosts)
      expect(matches.length).toBeLessThanOrEqual(3);
    });

    it('includes scoring instructions', () => {
      const cluster = createMockCluster();
      const prompt = buildScoringPrompt(cluster);
      expect(prompt).toContain('Severity');
      expect(prompt).toContain('Market Size');
      expect(prompt).toContain('Technical Complexity');
      expect(prompt).toContain('Time to MVP');
    });
  });

  describe('parseScoreResponse', () => {
    it('parses valid JSON response', () => {
      const response = `{
        "severity": { "score": 7, "reasoning": "High pain" },
        "marketSize": { "score": 5, "reasoning": "Medium market" },
        "technicalComplexity": { "score": 3, "reasoning": "Simple build" },
        "timeToMvp": { "score": 2, "reasoning": "Weekend project" }
      }`;

      const parsed = parseScoreResponse(response);
      expect(parsed).not.toBeNull();
      expect(parsed!.severity.score).toBe(7);
      expect(parsed!.marketSize.score).toBe(5);
      expect(parsed!.technicalComplexity.score).toBe(3);
      expect(parsed!.timeToMvp.score).toBe(2);
    });

    it('extracts JSON from markdown code blocks', () => {
      const response = `Here's my analysis:
\`\`\`json
{
  "severity": { "score": 8, "reasoning": "Critical" },
  "marketSize": { "score": 6, "reasoning": "Large" },
  "technicalComplexity": { "score": 4, "reasoning": "Moderate" },
  "timeToMvp": { "score": 3, "reasoning": "Week" }
}
\`\`\``;

      const parsed = parseScoreResponse(response);
      expect(parsed).not.toBeNull();
      expect(parsed!.severity.score).toBe(8);
    });

    it('clamps scores to 1-10 range', () => {
      const response = `{
        "severity": { "score": 15, "reasoning": "" },
        "marketSize": { "score": -2, "reasoning": "" },
        "technicalComplexity": { "score": 5, "reasoning": "" },
        "timeToMvp": { "score": 5, "reasoning": "" }
      }`;

      const parsed = parseScoreResponse(response);
      expect(parsed).not.toBeNull();
      expect(parsed!.severity.score).toBe(10); // Clamped from 15
      expect(parsed!.marketSize.score).toBe(1); // Clamped from -2
    });

    it('returns null for invalid JSON', () => {
      const response = 'This is not JSON at all';
      expect(parseScoreResponse(response)).toBeNull();
    });

    it('returns null for missing fields', () => {
      const response = `{
        "severity": { "score": 7 },
        "marketSize": { "score": 5 }
      }`;
      expect(parseScoreResponse(response)).toBeNull();
    });

    it('returns null for invalid score types', () => {
      const response = `{
        "severity": { "score": "high", "reasoning": "" },
        "marketSize": { "score": 5, "reasoning": "" },
        "technicalComplexity": { "score": 5, "reasoning": "" },
        "timeToMvp": { "score": 5, "reasoning": "" }
      }`;
      expect(parseScoreResponse(response)).toBeNull();
    });
  });

  describe('createDefaultScores', () => {
    it('creates scores based on frequency', () => {
      const cluster = createMockCluster({ frequency: 10, totalScore: 100 });
      const scores = createDefaultScores(cluster);

      expect(scores.severity.score).toBeGreaterThanOrEqual(1);
      expect(scores.severity.score).toBeLessThanOrEqual(10);
      expect(scores.severity.reasoning).toContain('10');
    });

    it('uses default medium values for complexity', () => {
      const cluster = createMockCluster();
      const scores = createDefaultScores(cluster);

      expect(scores.technicalComplexity.score).toBe(5);
      expect(scores.timeToMvp.score).toBe(5);
    });

    it('adds source bonus for multi-source clusters', () => {
      const singleSource = createMockCluster({
        frequency: 5,
        totalScore: 100,
        sources: ['reddit'],
      });
      const multiSource = createMockCluster({
        frequency: 5,
        totalScore: 100,
        sources: ['reddit', 'hn', 'twitter'],
      });

      const singleScores = createDefaultScores(singleSource);
      const multiScores = createDefaultScores(multiSource);

      expect(multiScores.severity.score).toBeGreaterThanOrEqual(singleScores.severity.score);
    });
  });

  describe('SCORING_SYSTEM_PROMPT', () => {
    it('exists and contains key instructions', () => {
      expect(SCORING_SYSTEM_PROMPT).toBeDefined();
      expect(SCORING_SYSTEM_PROMPT).toContain('startup');
      expect(SCORING_SYSTEM_PROMPT).toContain('JSON');
    });
  });
});

describe('Scorer', () => {
  describe('scoreProblem', () => {
    it('scores a cluster without AI', async () => {
      const cluster = createMockCluster({ frequency: 5 });
      const scored = await scoreProblem(cluster, { useAI: false });

      expect(scored.id).toBe(cluster.id);
      expect(scored.problemStatement).toBe(cluster.problemStatement);
      expect(scored.scores).toBeDefined();
      expect(scored.reasoning).toBeDefined();
    });

    it('calculates impact correctly', async () => {
      const cluster = createMockCluster({ frequency: 10 });
      const scored = await scoreProblem(cluster, { useAI: false });

      // IMPACT = frequency × severity × marketSize
      const expectedImpact = scored.scores.frequency *
        scored.scores.severity *
        scored.scores.marketSize;
      expect(scored.scores.impact).toBe(expectedImpact);
    });

    it('calculates effort correctly', async () => {
      const cluster = createMockCluster();
      const scored = await scoreProblem(cluster, { useAI: false });

      // EFFORT = technicalComplexity × timeToMvp
      const expectedEffort = scored.scores.technicalComplexity * scored.scores.timeToMvp;
      expect(scored.scores.effort).toBe(expectedEffort);
    });

    it('calculates priority correctly', async () => {
      const cluster = createMockCluster();
      const scored = await scoreProblem(cluster, { useAI: false });

      // PRIORITY = IMPACT / EFFORT
      const expectedPriority = scored.scores.impact / scored.scores.effort;
      expect(scored.scores.priority).toBeCloseTo(expectedPriority);
    });

    it('preserves cluster data', async () => {
      const cluster = createMockCluster({
        id: 'test-cluster-id',
        frequency: 8,
        sources: ['reddit', 'hn'],
      });
      const scored = await scoreProblem(cluster, { useAI: false });

      expect(scored.id).toBe('test-cluster-id');
      expect(scored.frequency).toBe(8);
      expect(scored.sources).toEqual(['reddit', 'hn']);
      expect(scored.representativePost).toBe(cluster.representativePost);
    });
  });

  describe('scoreAll', () => {
    it('returns empty array for empty input', async () => {
      const result = await scoreAll([]);
      expect(result).toEqual([]);
    });

    it('scores all clusters', async () => {
      const clusters = [
        createMockCluster({ problemStatement: 'Problem 1' }),
        createMockCluster({ problemStatement: 'Problem 2' }),
        createMockCluster({ problemStatement: 'Problem 3' }),
      ];
      const results = await scoreAll(clusters, { useAI: false });

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.scores).toBeDefined();
        expect(result.reasoning).toBeDefined();
      });
    });

    it('sorts results by priority descending', async () => {
      const clusters = Array(5).fill(null).map((_, i) =>
        createMockCluster({ frequency: i + 1 })
      );
      const results = await scoreAll(clusters, { useAI: false });

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].scores.priority)
          .toBeGreaterThanOrEqual(results[i + 1].scores.priority);
      }
    });

    it('respects maxConcurrent option', async () => {
      const clusters = Array(10).fill(null).map(() => createMockCluster());
      const results = await scoreAll(clusters, {
        useAI: false,
        maxConcurrent: 2,
      });

      expect(results.length).toBe(10);
    });
  });

  describe('getScoringStats', () => {
    it('returns zeros for empty input', () => {
      const stats = getScoringStats([]);

      expect(stats.count).toBe(0);
      expect(stats.avgPriority).toBe(0);
      expect(stats.avgImpact).toBe(0);
      expect(stats.avgEffort).toBe(0);
      expect(stats.topByPriority).toEqual([]);
    });

    it('calculates averages correctly', () => {
      const problems = [
        createMockScoredProblem({
          scores: {
            frequency: 5, severity: 8, marketSize: 6,
            technicalComplexity: 4, timeToMvp: 3,
            impact: 240, effort: 12, priority: 20,
          },
        }),
        createMockScoredProblem({
          scores: {
            frequency: 3, severity: 6, marketSize: 4,
            technicalComplexity: 6, timeToMvp: 5,
            impact: 72, effort: 30, priority: 2.4,
          },
        }),
      ];

      const stats = getScoringStats(problems);

      expect(stats.count).toBe(2);
      expect(stats.avgPriority).toBeCloseTo((20 + 2.4) / 2);
      expect(stats.avgImpact).toBeCloseTo((240 + 72) / 2);
      expect(stats.avgEffort).toBeCloseTo((12 + 30) / 2);
    });

    it('returns top problems by priority', () => {
      const problems = Array(10).fill(null).map((_, i) =>
        createMockScoredProblem({
          problemStatement: `Problem ${i}`,
          scores: {
            frequency: 5, severity: 5, marketSize: 5,
            technicalComplexity: 5, timeToMvp: 5,
            impact: 125, effort: 25, priority: i + 1,
          },
        })
      );

      const stats = getScoringStats(problems);

      expect(stats.topByPriority.length).toBe(5);
      expect(stats.topByPriority[0].priority).toBe(10);
    });

    it('identifies quick wins', () => {
      const problems = [
        createMockScoredProblem({
          problemStatement: 'Easy high-priority',
          scores: {
            frequency: 5, severity: 8, marketSize: 7,
            technicalComplexity: 2, timeToMvp: 2,
            impact: 280, effort: 4, priority: 70,
          },
        }),
        createMockScoredProblem({
          problemStatement: 'Hard high-priority',
          scores: {
            frequency: 5, severity: 8, marketSize: 7,
            technicalComplexity: 8, timeToMvp: 8,
            impact: 280, effort: 64, priority: 4.375,
          },
        }),
      ];

      const stats = getScoringStats(problems);

      expect(stats.quickWins.length).toBe(1);
      expect(stats.quickWins[0].statement).toBe('Easy high-priority');
    });
  });

  describe('exportScoredProblems', () => {
    it('exports to valid JSON', () => {
      const problems = [createMockScoredProblem()];
      const json = exportScoredProblems(problems);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].scores).toBeDefined();
      expect(parsed[0].reasoning).toBeDefined();
    });

    it('includes required fields', () => {
      const problem = createMockScoredProblem({
        id: 'test-id',
        problemStatement: 'Test statement',
        sources: ['reddit', 'hn'],
      });
      const json = exportScoredProblems([problem]);
      const parsed = JSON.parse(json);

      expect(parsed[0].id).toBe('test-id');
      expect(parsed[0].problemStatement).toBe('Test statement');
      expect(parsed[0].sources).toEqual(['reddit', 'hn']);
      expect(parsed[0].representativePost).toBeDefined();
    });
  });

  describe('filterByPriority', () => {
    it('filters by minimum priority', () => {
      const problems = [
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 10 } }),
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 20 } }),
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 5 } }),
      ];

      const filtered = filterByPriority(problems, 15);

      expect(filtered.length).toBe(1);
      expect(filtered[0].scores.priority).toBe(20);
    });

    it('returns empty for no matches', () => {
      const problems = [
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 5 } }),
      ];

      const filtered = filterByPriority(problems, 100);
      expect(filtered).toEqual([]);
    });
  });

  describe('filterByEffort', () => {
    it('filters by maximum effort', () => {
      const problems = [
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, effort: 10 } }),
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, effort: 50 } }),
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, effort: 25 } }),
      ];

      const filtered = filterByEffort(problems, 20);

      expect(filtered.length).toBe(1);
      expect(filtered[0].scores.effort).toBe(10);
    });
  });

  describe('getWeekendProjects', () => {
    it('returns problems with low timeToMvp and complexity', () => {
      const problems = [
        createMockScoredProblem({
          problemStatement: 'Weekend project',
          scores: { ...createMockScoredProblem().scores, timeToMvp: 2, technicalComplexity: 3, priority: 20 },
        }),
        createMockScoredProblem({
          problemStatement: 'Month project',
          scores: { ...createMockScoredProblem().scores, timeToMvp: 7, technicalComplexity: 6, priority: 50 },
        }),
        createMockScoredProblem({
          problemStatement: 'Another weekend',
          scores: { ...createMockScoredProblem().scores, timeToMvp: 1, technicalComplexity: 2, priority: 15 },
        }),
      ];

      const weekendProjects = getWeekendProjects(problems);

      expect(weekendProjects.length).toBe(2);
      expect(weekendProjects[0].problemStatement).toBe('Weekend project');
      expect(weekendProjects[1].problemStatement).toBe('Another weekend');
    });

    it('sorts by priority', () => {
      const problems = [
        createMockScoredProblem({
          scores: { ...createMockScoredProblem().scores, timeToMvp: 1, technicalComplexity: 2, priority: 10 },
        }),
        createMockScoredProblem({
          scores: { ...createMockScoredProblem().scores, timeToMvp: 2, technicalComplexity: 3, priority: 30 },
        }),
      ];

      const weekendProjects = getWeekendProjects(problems);

      expect(weekendProjects[0].scores.priority).toBe(30);
      expect(weekendProjects[1].scores.priority).toBe(10);
    });
  });
});

describe('Scoring Formula', () => {
  it('high frequency increases impact', async () => {
    const lowFreq = createMockCluster({ frequency: 2 });
    const highFreq = createMockCluster({ frequency: 20 });

    const lowScored = await scoreProblem(lowFreq, { useAI: false });
    const highScored = await scoreProblem(highFreq, { useAI: false });

    expect(highScored.scores.frequency).toBeGreaterThan(lowScored.scores.frequency);
  });

  it('priority favors high impact low effort', async () => {
    // High engagement cluster (likely higher default scores)
    const highEngagement = createMockCluster({
      frequency: 15,
      totalScore: 1000,
      sources: ['reddit', 'hn', 'twitter'],
    });

    // Low engagement cluster
    const lowEngagement = createMockCluster({
      frequency: 2,
      totalScore: 50,
      sources: ['reddit'],
    });

    const highScored = await scoreProblem(highEngagement, { useAI: false });
    const lowScored = await scoreProblem(lowEngagement, { useAI: false });

    expect(highScored.scores.impact).toBeGreaterThan(lowScored.scores.impact);
  });
});
