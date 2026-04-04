/**
 * Tests for computeEvidenceStrength()
 *
 * Verifies evidence tier classification based on platform count,
 * engagement, and frequency from ScoredProblem data.
 */

import { describe, it, expect } from 'vitest';
import { computeEvidenceStrength, type ScoredProblem } from '../../src/analysis/scorer';

/** Minimal ScoredProblem factory for evidence strength tests */
function makeProblem(overrides: {
  frequency?: number;
  totalScore?: number;
  sources?: ('reddit' | 'hn' | 'twitter' | 'github')[];
}): ScoredProblem {
  return {
    id: 'test-id',
    representativePost: {
      id: 'post-1',
      source: 'reddit',
      sourceId: 'abc',
      title: 'Test Post',
      body: '',
      url: 'https://reddit.com/r/test/1',
      author: 'testuser',
      score: 10,
      commentCount: 5,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: [],
    },
    relatedPosts: [],
    frequency: overrides.frequency ?? 1,
    totalScore: overrides.totalScore ?? 0,
    embedding: [],
    problemStatement: 'Test problem',
    sources: overrides.sources ?? ['reddit'],
    scores: {
      frequency: 1,
      severity: 5,
      marketSize: 5,
      technicalComplexity: 5,
      timeToMvp: 5,
      engagement: 5,
      impact: 25,
      effort: 5,
      priority: 50,
    },
    reasoning: {
      severity: 'test',
      marketSize: 'test',
      technicalComplexity: 'test',
    },
  };
}

describe('computeEvidenceStrength', () => {
  describe('strong tier', () => {
    it('classifies multi-platform + high engagement as strong', () => {
      const problem = makeProblem({
        frequency: 5,
        totalScore: 150,
        sources: ['reddit', 'hn'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('strong');
      expect(result.platformCount).toBe(2);
      expect(result.totalEngagement).toBe(150);
    });

    it('classifies multi-platform + high frequency as strong', () => {
      const problem = makeProblem({
        frequency: 3,
        totalScore: 30,
        sources: ['reddit', 'github'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('strong');
    });

    it('requires multi-platform for strong — single platform + high engagement is NOT strong', () => {
      const problem = makeProblem({
        frequency: 1,
        totalScore: 200,
        sources: ['reddit'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).not.toBe('strong');
      // Single platform + high engagement = moderate
      expect(result.tier).toBe('moderate');
    });

    it('requires engagement OR frequency for strong — multi-platform alone is moderate', () => {
      const problem = makeProblem({
        frequency: 1,
        totalScore: 10,
        sources: ['reddit', 'hn'],
      });
      const result = computeEvidenceStrength(problem);
      // platformCount >= 2 but neither totalEngagement >= 100 nor frequency >= 3
      expect(result.tier).toBe('moderate');
    });
  });

  describe('moderate tier', () => {
    it('classifies frequency >= 2 as moderate', () => {
      const problem = makeProblem({
        frequency: 2,
        totalScore: 10,
        sources: ['reddit'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('moderate');
    });

    it('classifies totalEngagement >= 50 as moderate', () => {
      const problem = makeProblem({
        frequency: 1,
        totalScore: 50,
        sources: ['reddit'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('moderate');
    });

    it('classifies platformCount >= 2 (without strong criteria) as moderate', () => {
      const problem = makeProblem({
        frequency: 1,
        totalScore: 5,
        sources: ['reddit', 'github'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('moderate');
    });
  });

  describe('weak tier', () => {
    it('classifies single source, low engagement as weak', () => {
      const problem = makeProblem({
        frequency: 1,
        totalScore: 10,
        sources: ['reddit'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('weak');
    });

    it('classifies just below moderate thresholds as weak', () => {
      const problem = makeProblem({
        frequency: 1,
        totalScore: 49,
        sources: ['reddit'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('weak');
    });
  });

  describe('edge cases', () => {
    it('handles frequency=0 and empty sources', () => {
      const problem = makeProblem({
        frequency: 0,
        totalScore: 0,
        sources: [],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.tier).toBe('weak');
      expect(result.sourceCount).toBe(0);
      expect(result.totalEngagement).toBe(0);
      expect(result.platformCount).toBe(0);
    });

    it('deduplicates platform count from repeated sources', () => {
      const problem = makeProblem({
        frequency: 5,
        totalScore: 30,
        sources: ['reddit', 'reddit', 'reddit', 'hn', 'hn'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result.platformCount).toBe(2);
    });

    it('returns correct metadata fields', () => {
      const problem = makeProblem({
        frequency: 3,
        totalScore: 75,
        sources: ['reddit', 'hn', 'github'],
      });
      const result = computeEvidenceStrength(problem);
      expect(result).toEqual({
        tier: 'strong',
        sourceCount: 3,
        totalEngagement: 75,
        platformCount: 3,
      });
    });

    it('is a pure function — does not mutate the input', () => {
      const problem = makeProblem({
        frequency: 2,
        totalScore: 60,
        sources: ['reddit'],
      });
      const originalSources = [...problem.sources];
      computeEvidenceStrength(problem);
      expect(problem.sources).toEqual(originalSources);
      expect(problem.evidenceMetadata).toBeUndefined();
    });
  });

  describe('boundary conditions', () => {
    it('totalEngagement=100 + multi-platform = strong', () => {
      const result = computeEvidenceStrength(
        makeProblem({ frequency: 1, totalScore: 100, sources: ['reddit', 'hn'] })
      );
      expect(result.tier).toBe('strong');
    });

    it('totalEngagement=99 + multi-platform = moderate (not strong)', () => {
      const result = computeEvidenceStrength(
        makeProblem({ frequency: 1, totalScore: 99, sources: ['reddit', 'hn'] })
      );
      expect(result.tier).toBe('moderate');
    });

    it('frequency=3 + multi-platform = strong', () => {
      const result = computeEvidenceStrength(
        makeProblem({ frequency: 3, totalScore: 10, sources: ['reddit', 'hn'] })
      );
      expect(result.tier).toBe('strong');
    });

    it('frequency=2 + single-platform = moderate (not strong)', () => {
      const result = computeEvidenceStrength(
        makeProblem({ frequency: 2, totalScore: 10, sources: ['reddit'] })
      );
      expect(result.tier).toBe('moderate');
    });

    it('totalEngagement=50 + single-platform = moderate', () => {
      const result = computeEvidenceStrength(
        makeProblem({ frequency: 1, totalScore: 50, sources: ['reddit'] })
      );
      expect(result.tier).toBe('moderate');
    });

    it('totalEngagement=49 + single-platform + frequency=1 = weak', () => {
      const result = computeEvidenceStrength(
        makeProblem({ frequency: 1, totalScore: 49, sources: ['reddit'] })
      );
      expect(result.tier).toBe('weak');
    });
  });
});
