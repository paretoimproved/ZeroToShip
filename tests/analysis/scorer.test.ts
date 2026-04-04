/**
 * Tests for the Problem Scoring Module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
  calculateEngagementScore,
  type ScoredProblem,
} from '../../src/analysis/scorer';
import {
  buildScoringPrompt,
  parseScoreResponse,
  createDefaultScores,
  SCORING_SYSTEM_PROMPT,
  BATCH_SCORING_SYSTEM_PROMPT,
  buildBatchScoringPrompt,
  parseBatchScoreResponse,
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
      engagement: 5,
      impact: 210,
      effort: 12,
      priority: 50,
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

  describe('BATCH_SCORING_SYSTEM_PROMPT', () => {
    it('exists and contains batch-specific instructions', () => {
      expect(BATCH_SCORING_SYSTEM_PROMPT).toBeDefined();
      expect(BATCH_SCORING_SYSTEM_PROMPT).toContain('MULTIPLE');
      expect(BATCH_SCORING_SYSTEM_PROMPT).toContain('JSON array');
    });
  });

  describe('buildBatchScoringPrompt', () => {
    it('includes all problem statements', () => {
      const clusters = [
        createMockCluster({ id: 'c1', problemStatement: 'Problem Alpha' }),
        createMockCluster({ id: 'c2', problemStatement: 'Problem Beta' }),
        createMockCluster({ id: 'c3', problemStatement: 'Problem Gamma' }),
      ];
      const prompt = buildBatchScoringPrompt(clusters);

      expect(prompt).toContain('Problem Alpha');
      expect(prompt).toContain('Problem Beta');
      expect(prompt).toContain('Problem Gamma');
    });

    it('includes cluster IDs for mapping', () => {
      const clusters = [
        createMockCluster({ id: 'cluster_abc123' }),
        createMockCluster({ id: 'cluster_def456' }),
      ];
      const prompt = buildBatchScoringPrompt(clusters);

      expect(prompt).toContain('cluster_abc123');
      expect(prompt).toContain('cluster_def456');
    });

    it('includes correct problem count', () => {
      const clusters = Array(5).fill(null).map((_, i) =>
        createMockCluster({ id: `c${i}` })
      );
      const prompt = buildBatchScoringPrompt(clusters);

      expect(prompt).toContain('5 startup problems');
    });

    it('includes frequency and sources for each problem', () => {
      const cluster = createMockCluster({
        id: 'test',
        frequency: 15,
        sources: ['reddit', 'hn', 'twitter'],
      });
      const prompt = buildBatchScoringPrompt([cluster]);

      expect(prompt).toContain('15 mentions');
      expect(prompt).toContain('reddit, hn, twitter');
    });
  });

  describe('parseBatchScoreResponse', () => {
    it('parses valid batch JSON response', () => {
      const response = `[
        {
          "id": "c1",
          "severity": { "score": 7, "reasoning": "High pain" },
          "marketSize": { "score": 5, "reasoning": "Medium market" },
          "technicalComplexity": { "score": 3, "reasoning": "Simple build" },
          "timeToMvp": { "score": 2, "reasoning": "Weekend project" }
        },
        {
          "id": "c2",
          "severity": { "score": 8, "reasoning": "Critical" },
          "marketSize": { "score": 9, "reasoning": "Large market" },
          "technicalComplexity": { "score": 6, "reasoning": "Moderate" },
          "timeToMvp": { "score": 4, "reasoning": "Week project" }
        }
      ]`;

      const results = parseBatchScoreResponse(response, ['c1', 'c2']);

      expect(results.size).toBe(2);
      expect(results.get('c1')?.severity.score).toBe(7);
      expect(results.get('c1')?.marketSize.score).toBe(5);
      expect(results.get('c2')?.severity.score).toBe(8);
      expect(results.get('c2')?.marketSize.score).toBe(9);
    });

    it('extracts JSON array from markdown code blocks', () => {
      const response = `Here's my analysis:
\`\`\`json
[
  {
    "id": "c1",
    "severity": { "score": 8, "reasoning": "Critical" },
    "marketSize": { "score": 6, "reasoning": "Large" },
    "technicalComplexity": { "score": 4, "reasoning": "Moderate" },
    "timeToMvp": { "score": 3, "reasoning": "Week" }
  }
]
\`\`\``;

      const results = parseBatchScoreResponse(response, ['c1']);

      expect(results.size).toBe(1);
      expect(results.get('c1')?.severity.score).toBe(8);
    });

    it('clamps scores to 1-10 range', () => {
      const response = `[
        {
          "id": "c1",
          "severity": { "score": 15, "reasoning": "" },
          "marketSize": { "score": -2, "reasoning": "" },
          "technicalComplexity": { "score": 5, "reasoning": "" },
          "timeToMvp": { "score": 5, "reasoning": "" }
        }
      ]`;

      const results = parseBatchScoreResponse(response, ['c1']);

      expect(results.get('c1')?.severity.score).toBe(10); // Clamped from 15
      expect(results.get('c1')?.marketSize.score).toBe(1); // Clamped from -2
    });

    it('returns empty map for invalid JSON', () => {
      const response = 'This is not JSON at all';
      const results = parseBatchScoreResponse(response, ['c1']);
      expect(results.size).toBe(0);
    });

    it('skips items with missing required fields', () => {
      const response = `[
        {
          "id": "c1",
          "severity": { "score": 7, "reasoning": "Valid" },
          "marketSize": { "score": 5, "reasoning": "Valid" },
          "technicalComplexity": { "score": 3, "reasoning": "Valid" },
          "timeToMvp": { "score": 2, "reasoning": "Valid" }
        },
        {
          "id": "c2",
          "severity": { "score": 8 }
        }
      ]`;

      const results = parseBatchScoreResponse(response, ['c1', 'c2']);

      expect(results.size).toBe(1);
      expect(results.has('c1')).toBe(true);
      expect(results.has('c2')).toBe(false);
    });

    it('handles partial batch responses gracefully', () => {
      const response = `[
        {
          "id": "c1",
          "severity": { "score": 7, "reasoning": "" },
          "marketSize": { "score": 5, "reasoning": "" },
          "technicalComplexity": { "score": 3, "reasoning": "" },
          "timeToMvp": { "score": 2, "reasoning": "" }
        }
      ]`;

      // Expecting 3 IDs but only got 1
      const results = parseBatchScoreResponse(response, ['c1', 'c2', 'c3']);

      expect(results.size).toBe(1);
      expect(results.has('c1')).toBe(true);
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

      // IMPACT = frequency × severity × marketSize × (engagement / 5)
      const expectedImpact = scored.scores.frequency *
        scored.scores.severity *
        scored.scores.marketSize *
        (scored.scores.engagement / 5);
      expect(scored.scores.impact).toBeCloseTo(expectedImpact);
    });

    it('calculates effort correctly with sub-linear scaling', async () => {
      const cluster = createMockCluster();
      const scored = await scoreProblem(cluster, { useAI: false });

      // EFFORT = (technicalComplexity × timeToMvp) ^ 0.7
      const expectedEffort = Math.pow(
        scored.scores.technicalComplexity * scored.scores.timeToMvp,
        0.7,
      );
      expect(scored.scores.effort).toBeCloseTo(expectedEffort);
    });

    it('calculates priority correctly', async () => {
      const cluster = createMockCluster();
      const scored = await scoreProblem(cluster, { useAI: false });

      // PRIORITY = normalizePriority(IMPACT / EFFORT)
      const rawPriority = scored.scores.impact / scored.scores.effort;
      const expectedPriority = Math.max(0, Math.min(100, Math.round(Math.log10(rawPriority) * 40)));
      expect(scored.scores.priority).toBe(expectedPriority);
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

    it('preserves current cluster identity for cached scores', async () => {
      const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z2s-score-cache-'));
      try {
        const problemStatement = 'Users struggle with multi-tenant billing reconciliation';
        const sharedUrl = 'https://example.com/shared-problem';

        const firstCluster = createMockCluster({
          id: 'cluster_old',
          frequency: 3,
          problemStatement,
          representativePost: createMockPost({ url: sharedUrl }),
        });

        const secondCluster = createMockCluster({
          id: 'cluster_new',
          frequency: 9,
          problemStatement,
          representativePost: createMockPost({ url: sharedUrl }),
        });

        await scoreAll([firstCluster], {
          useAI: false,
          scoreCacheOptions: { cacheDir },
        });

        const cachedResults = await scoreAll([secondCluster], {
          useAI: false,
          scoreCacheOptions: { cacheDir },
        });

        expect(cachedResults).toHaveLength(1);
        expect(cachedResults[0].id).toBe('cluster_new');
        expect(cachedResults[0].problemStatement).toBe(problemStatement);
        expect(cachedResults[0].frequency).toBe(9);
        expect(cachedResults[0].representativePost.url).toBe(sharedUrl);
      } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
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
            technicalComplexity: 4, timeToMvp: 3, engagement: 5,
            impact: 240, effort: 12, priority: 52,
          },
        }),
        createMockScoredProblem({
          scores: {
            frequency: 3, severity: 6, marketSize: 4,
            technicalComplexity: 6, timeToMvp: 5, engagement: 5,
            impact: 72, effort: 30, priority: 15,
          },
        }),
      ];

      const stats = getScoringStats(problems);

      expect(stats.count).toBe(2);
      expect(stats.avgPriority).toBeCloseTo((52 + 15) / 2);
      expect(stats.avgImpact).toBeCloseTo((240 + 72) / 2);
      expect(stats.avgEffort).toBeCloseTo((12 + 30) / 2);
    });

    it('returns top problems by priority', () => {
      const problems = Array(10).fill(null).map((_, i) =>
        createMockScoredProblem({
          problemStatement: `Problem ${i}`,
          scores: {
            frequency: 5, severity: 5, marketSize: 5,
            technicalComplexity: 5, timeToMvp: 5, engagement: 5,
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
            technicalComplexity: 2, timeToMvp: 2, engagement: 5,
            impact: 280, effort: 4, priority: 70,
          },
        }),
        createMockScoredProblem({
          problemStatement: 'Hard high-priority',
          scores: {
            frequency: 5, severity: 8, marketSize: 7,
            technicalComplexity: 8, timeToMvp: 8, engagement: 5,
            impact: 280, effort: 64, priority: 26,
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
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 40 } }),
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 52 } }),
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 28 } }),
      ];

      const filtered = filterByPriority(problems, 45);

      expect(filtered.length).toBe(1);
      expect(filtered[0].scores.priority).toBe(52);
    });

    it('returns empty for no matches', () => {
      const problems = [
        createMockScoredProblem({ scores: { ...createMockScoredProblem().scores, priority: 28 } }),
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
          scores: { ...createMockScoredProblem().scores, timeToMvp: 2, technicalComplexity: 3, engagement: 5, priority: 52 },
        }),
        createMockScoredProblem({
          problemStatement: 'Month project',
          scores: { ...createMockScoredProblem().scores, timeToMvp: 7, technicalComplexity: 6, engagement: 5, priority: 68 },
        }),
        createMockScoredProblem({
          problemStatement: 'Another weekend',
          scores: { ...createMockScoredProblem().scores, timeToMvp: 1, technicalComplexity: 2, engagement: 5, priority: 47 },
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
          scores: { ...createMockScoredProblem().scores, timeToMvp: 1, technicalComplexity: 2, engagement: 5, priority: 40 },
        }),
        createMockScoredProblem({
          scores: { ...createMockScoredProblem().scores, timeToMvp: 2, technicalComplexity: 3, engagement: 5, priority: 59 },
        }),
      ];

      const weekendProjects = getWeekendProjects(problems);

      expect(weekendProjects[0].scores.priority).toBe(59);
      expect(weekendProjects[1].scores.priority).toBe(40);
    });
  });
});

describe('Batch Scoring Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should batch 20 problems into single API call', async () => {
    // Create 25 mock clusters
    const clusters = Array(25).fill(null).map((_, i) =>
      createMockCluster({ id: `cluster_${i}`, problemStatement: `Problem ${i}` })
    );

    // Mock fetch to return valid batch responses
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify(
            clusters.slice(0, 20).map(c => ({
              id: c.id,
              severity: { score: 7, reasoning: 'Test' },
              marketSize: { score: 6, reasoning: 'Test' },
              technicalComplexity: { score: 4, reasoning: 'Test' },
              timeToMvp: { score: 3, reasoning: 'Test' },
            }))
          ),
        }],
      }), { status: 200 });
    });

    await scoreAll(clusters, {
      useAI: true,
      anthropicApiKey: 'test-key',
      delayBetweenCalls: 0,
      scoreCacheOptions: { disabled: true },
    });

    // Verify only 2 API calls made (ceil(25/20) = 2)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should make correct number of batches for various sizes', async () => {
    const testCases = [
      { count: 1, expectedBatches: 1 },
      { count: 20, expectedBatches: 1 },
      { count: 21, expectedBatches: 2 },
      { count: 40, expectedBatches: 2 },
      { count: 41, expectedBatches: 3 },
    ];

    for (const { count, expectedBatches } of testCases) {
      vi.restoreAllMocks();

      const clusters = Array(count).fill(null).map((_, i) =>
        createMockCluster({ id: `cluster_${i}` })
      );

      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({
          content: [{ type: 'text', text: '[]' }],
        }), { status: 200 });
      });

      await scoreAll(clusters, {
        useAI: true,
        anthropicApiKey: 'test-key',
        delayBetweenCalls: 0,
        scoreCacheOptions: { disabled: true },
      });

      expect(fetchSpy).toHaveBeenCalledTimes(expectedBatches);
    }
  });

  it('should fallback to defaults on batch API failure', async () => {
    const clusters = [
      createMockCluster({ id: 'c1', frequency: 10 }),
    ];

    // Mock API failure
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('API Error'));

    const results = await scoreAll(clusters, {
      useAI: true,
      anthropicApiKey: 'test-key',
    });

    // Should still return results with default scores
    expect(results).toHaveLength(1);
    expect(results[0].scores.severity).toBeDefined();
    expect(results[0].scores.marketSize).toBeDefined();
    expect(results[0].reasoning.severity).toContain('frequency'); // Default reasoning
  });

  it('should use default scores when AI is disabled', async () => {
    const clusters = [createMockCluster({ id: 'c1' })];

    const fetchSpy = vi.spyOn(global, 'fetch');

    const results = await scoreAll(clusters, { useAI: false });

    // No API calls should be made
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].scores).toBeDefined();
  });

  it('should correctly map batch response scores to clusters', async () => {
    const clusters = [
      createMockCluster({ id: 'cluster_a', problemStatement: 'Problem A' }),
      createMockCluster({ id: 'cluster_b', problemStatement: 'Problem B' }),
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify([
            {
              id: 'cluster_a',
              severity: { score: 9, reasoning: 'Very severe' },
              marketSize: { score: 8, reasoning: 'Large market' },
              technicalComplexity: { score: 3, reasoning: 'Simple' },
              timeToMvp: { score: 2, reasoning: 'Quick' },
            },
            {
              id: 'cluster_b',
              severity: { score: 4, reasoning: 'Minor' },
              marketSize: { score: 5, reasoning: 'Medium market' },
              technicalComplexity: { score: 7, reasoning: 'Complex' },
              timeToMvp: { score: 6, reasoning: 'Takes time' },
            },
          ]),
        }],
      }), { status: 200 });
    });

    const results = await scoreAll(clusters, {
      useAI: true,
      anthropicApiKey: 'test-key',
      scoreCacheOptions: { disabled: true },
    });

    // Find results by problem statement (order may change due to sorting)
    const resultA = results.find(r => r.id === 'cluster_a');
    const resultB = results.find(r => r.id === 'cluster_b');

    expect(resultA?.scores.severity).toBe(9);
    expect(resultA?.reasoning.severity).toBe('Very severe');
    expect(resultB?.scores.severity).toBe(4);
    expect(resultB?.reasoning.technicalComplexity).toBe('Complex');
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

  it('high-effort problem still gets a reasonable priority score', async () => {
    // A problem with complexity=6, timeToMvp=5 (raw effort=30) should not
    // be crushed below a priority of 10 when impact factors are decent.
    const cluster = createMockCluster({
      frequency: 15,
      totalScore: 500,
      sources: ['reddit', 'hn'],
    });

    const scored = await scoreProblem(cluster, { useAI: false });

    // With sub-linear scaling, effort = 30^0.7 ≈ 12.2 instead of 30,
    // so high-impact ideas should retain a meaningful priority.
    expect(scored.scores.priority).toBeGreaterThanOrEqual(10);
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

describe('Engagement Scoring', () => {
  describe('calculateEngagementScore', () => {
    it('returns 1 for zero frequency', () => {
      expect(calculateEngagementScore(0, 0)).toBe(1);
    });

    it('returns 1 for zero total score', () => {
      expect(calculateEngagementScore(0, 5)).toBeCloseTo(1, 0);
    });

    it('returns ~4.1 for avg engagement of 10', () => {
      const score = calculateEngagementScore(100, 10); // avg = 10
      expect(score).toBeGreaterThan(3.5);
      expect(score).toBeLessThan(5);
    });

    it('returns ~7 for avg engagement of 100', () => {
      const score = calculateEngagementScore(1000, 10); // avg = 100
      expect(score).toBeGreaterThan(6);
      expect(score).toBeLessThan(8);
    });

    it('clamps to max 10', () => {
      const score = calculateEngagementScore(100000, 1); // avg = 100000
      expect(score).toBe(10);
    });

    it('clamps to min 1', () => {
      const score = calculateEngagementScore(0, 100);
      expect(score).toBeGreaterThanOrEqual(1);
    });

    it('higher avg engagement produces higher score', () => {
      const low = calculateEngagementScore(10, 10); // avg = 1
      const high = calculateEngagementScore(500, 10); // avg = 50
      expect(high).toBeGreaterThan(low);
    });
  });

  it('scored problem includes engagement field', async () => {
    const cluster = createMockCluster({ frequency: 5, totalScore: 250 });
    const scored = await scoreProblem(cluster, { useAI: false });

    expect(scored.scores.engagement).toBeDefined();
    expect(scored.scores.engagement).toBeGreaterThanOrEqual(1);
    expect(scored.scores.engagement).toBeLessThanOrEqual(10);
  });

  it('zero-engagement cluster scores lower than high-engagement cluster', async () => {
    const zeroEngagement = createMockCluster({
      frequency: 5,
      totalScore: 0,
    });
    const highEngagement = createMockCluster({
      frequency: 5,
      totalScore: 500,
    });

    const zeroScored = await scoreProblem(zeroEngagement, { useAI: false });
    const highScored = await scoreProblem(highEngagement, { useAI: false });

    expect(highScored.scores.engagement).toBeGreaterThan(zeroScored.scores.engagement);
    expect(highScored.scores.impact).toBeGreaterThan(zeroScored.scores.impact);
  });

  it('engagement factor is included in impact calculation', async () => {
    const cluster = createMockCluster({ frequency: 10, totalScore: 100 });
    const scored = await scoreProblem(cluster, { useAI: false });

    // IMPACT = frequency × severity × marketSize × (engagement / 5)
    const baseImpact = scored.scores.frequency *
      scored.scores.severity *
      scored.scores.marketSize;
    const expectedImpact = baseImpact * (scored.scores.engagement / 5);
    expect(scored.scores.impact).toBeCloseTo(expectedImpact);
  });
});
