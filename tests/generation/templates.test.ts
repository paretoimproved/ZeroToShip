/**
 * Tests for the Brief Generation Templates Module
 */

import { describe, it, expect } from 'vitest';
import {
  BRIEF_SYSTEM_PROMPT,
  buildBriefPrompt,
  buildNamePrompt,
  buildBusinessModelPrompt,
  buildGTMPrompt,
  buildRiskPrompt,
  parseJsonResponse,
  effortToString,
  scoreToEffortLevel,
} from '../../src/generation/templates';
import type { ScoredProblem } from '../../src/analysis/scorer';
import type { GapAnalysis } from '../../src/analysis/gap-analyzer';
import type { TechStackRecommendation, EffortLevel } from '../../src/generation/tech-stacks';

// Mock data factories
function createMockScoredProblem(overrides: Partial<ScoredProblem> = {}): ScoredProblem {
  return {
    id: 'test-cluster-1',
    representativePost: {
      id: 'post-1',
      source: 'reddit',
      sourceId: 'abc123',
      title: 'Need better expense tracking',
      body: 'I spend hours tracking expenses manually',
      url: 'https://reddit.com/r/test/123',
      author: 'testuser',
      score: 250,
      commentCount: 45,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: [],
    },
    relatedPosts: [],
    frequency: 5,
    totalScore: 500,
    embedding: [],
    problemStatement: 'Users need a better way to track business expenses automatically',
    sources: ['reddit', 'hn'],
    scores: {
      frequency: 5,
      severity: 7,
      marketSize: 8,
      technicalComplexity: 4,
      timeToMvp: 3,
      engagement: 5,
      impact: 280,
      effort: 12,
      priority: 23.33,
    },
    reasoning: {
      severity: 'High pain point',
      marketSize: 'Large market',
      technicalComplexity: 'Moderate complexity',
    },
    ...overrides,
  } as ScoredProblem;
}

function createMockGapAnalysis(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  return {
    problemId: 'test-cluster-1',
    problemStatement: 'Users need better expense tracking',
    searchQueries: ['expense tracking tool', 'best expense software'],
    existingSolutions: [
      {
        name: 'Expensify',
        url: 'https://expensify.com',
        description: 'Expense management platform',
        pricing: 'freemium',
        strengths: ['Mobile app', 'Integrations'],
        weaknesses: ['Complex pricing', 'Learning curve'],
      },
    ],
    gaps: ['No simple solo solution', 'Poor receipt OCR'],
    marketOpportunity: 'medium',
    differentiationAngles: ['AI-first approach', 'Simpler UX'],
    recommendation: 'Proceed with MVP',
    competitionScore: 45,
    analysisNotes: 'Competitive but opportunities exist',
    analyzedAt: new Date(),
    ...overrides,
  };
}

function createMockStackRecommendation(overrides: Partial<TechStackRecommendation> = {}): TechStackRecommendation {
  return {
    name: 'Next.js + Vercel',
    stack: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'Vercel Postgres'],
    architecture: 'Serverless full-stack',
    hosting: 'Vercel (free tier)',
    estimatedCost: '$0-20/month',
    bestFor: ['SaaS dashboards', 'Landing pages'],
    ...overrides,
  };
}

describe('BRIEF_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof BRIEF_SYSTEM_PROMPT).toBe('string');
    expect(BRIEF_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('includes role description', () => {
    expect(BRIEF_SYSTEM_PROMPT).toContain('startup strategist');
  });

  it('mentions JSON output format', () => {
    expect(BRIEF_SYSTEM_PROMPT).toContain('JSON');
  });

  it('includes guidelines for recommendations', () => {
    expect(BRIEF_SYSTEM_PROMPT).toContain('specific');
    expect(BRIEF_SYSTEM_PROMPT).toContain('agent-ready');
  });
});

describe('buildBriefPrompt', () => {
  it('includes problem statement', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain(problem.problemStatement);
  });

  it('includes signal strength data', () => {
    const problem = createMockScoredProblem({ frequency: 10 });
    const gaps = createMockGapAnalysis();
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain('Frequency: 10');
    expect(prompt).toContain('Priority Score');
    expect(prompt).toContain('Impact Score');
  });

  it('includes representative post details', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain('Representative Post');
    expect(prompt).toContain(problem.representativePost.title);
    expect(prompt).toContain(problem.representativePost.url);
  });

  it('includes competitive landscape', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ marketOpportunity: 'high', competitionScore: 25 });
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain('**Market Opportunity:** HIGH');
    expect(prompt).toContain('**Competition Score:** 25/100');
  });

  it('includes existing solutions list', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain('Existing Solutions');
    expect(prompt).toContain('Expensify');
  });

  it('includes gaps and differentiation angles', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({
      gaps: ['Gap A', 'Gap B'],
      differentiationAngles: ['Angle 1', 'Angle 2'],
    });
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain('Gap A');
    expect(prompt).toContain('Angle 1');
  });

  it('includes tech stack recommendation', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();
    const stack = createMockStackRecommendation({
      stack: ['Next.js', 'PostgreSQL', 'Stripe'],
      estimatedCost: '$10-50/month',
    });

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain('Suggested Tech Stack');
    expect(prompt).toContain('Next.js');
    expect(prompt).toContain('$10-50/month');
  });

  it('includes effort level constraint', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'month');

    expect(prompt).toContain('**Effort Level:** month');
  });

  it('includes JSON output requirements', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'weekend');

    expect(prompt).toContain('JSON');
    expect(prompt).toContain('name');
    expect(prompt).toContain('tagline');
    expect(prompt).toContain('mvpScope');
  });

  it('handles empty existing solutions', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ existingSolutions: [] });
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    expect(prompt).toContain('None identified');
  });

  it('limits solutions to 5', () => {
    const manySolutions = Array(10).fill(null).map((_, i) => ({
      name: `Solution ${i}`,
      url: `https://solution${i}.com`,
      description: `Description ${i}`,
      pricing: 'paid',
      strengths: [],
      weaknesses: [],
    }));

    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ existingSolutions: manySolutions });
    const stack = createMockStackRecommendation();

    const prompt = buildBriefPrompt(problem, gaps, stack, 'week');

    // Should only include first 5
    expect(prompt).toContain('Solution 0');
    expect(prompt).toContain('Solution 4');
    expect(prompt).not.toContain('Solution 5');
  });
});

describe('buildNamePrompt', () => {
  it('includes problem statement', () => {
    const problem = createMockScoredProblem({
      problemStatement: 'Need better project management for remote teams',
    });

    const prompt = buildNamePrompt(problem);

    expect(prompt).toContain('Need better project management for remote teams');
  });

  it('specifies name requirements', () => {
    const problem = createMockScoredProblem();
    const prompt = buildNamePrompt(problem);

    expect(prompt).toContain('1-2 words');
    expect(prompt).toContain('memorable');
  });

  it('specifies tagline requirements', () => {
    const problem = createMockScoredProblem();
    const prompt = buildNamePrompt(problem);

    expect(prompt).toContain('Under 10 words');
    expect(prompt).toContain('value proposition');
  });

  it('requests JSON response', () => {
    const problem = createMockScoredProblem();
    const prompt = buildNamePrompt(problem);

    expect(prompt).toContain('JSON');
    expect(prompt).toContain('name');
    expect(prompt).toContain('tagline');
    expect(prompt).toContain('domainSuggestions');
  });
});

describe('buildBusinessModelPrompt', () => {
  it('includes problem and gap analysis', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ marketOpportunity: 'high' });

    const prompt = buildBusinessModelPrompt(problem, gaps);

    expect(prompt).toContain(problem.problemStatement);
    expect(prompt).toContain('**Market Opportunity:** high');
    expect(prompt).toContain(`**Existing Competitors:** ${gaps.existingSolutions.length}`);
  });

  it('lists revenue model options', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();

    const prompt = buildBusinessModelPrompt(problem, gaps);

    expect(prompt).toContain('SaaS subscription');
    expect(prompt).toContain('Usage-based pricing');
    expect(prompt).toContain('Freemium');
    expect(prompt).toContain('Marketplace');
  });

  it('requests pricing strategy', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();

    const prompt = buildBusinessModelPrompt(problem, gaps);

    expect(prompt).toContain('Free tier');
    expect(prompt).toContain('Paid tier');
    expect(prompt).toContain('Enterprise');
  });

  it('includes key gaps', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ gaps: ['Gap 1', 'Gap 2', 'Gap 3'] });

    const prompt = buildBusinessModelPrompt(problem, gaps);

    expect(prompt).toContain('**Key Gaps:** Gap 1; Gap 2; Gap 3');
  });
});

describe('buildGTMPrompt', () => {
  it('includes problem and sources', () => {
    const problem = createMockScoredProblem({ sources: ['reddit', 'hn', 'twitter'] });
    const gaps = createMockGapAnalysis();

    const prompt = buildGTMPrompt(problem, gaps);

    expect(prompt).toContain(problem.problemStatement);
    expect(prompt).toContain('reddit, hn, twitter');
  });

  it('includes market opportunity', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ marketOpportunity: 'medium' });

    const prompt = buildGTMPrompt(problem, gaps);

    expect(prompt).toContain('**Market opportunity:** medium');
  });

  it('includes differentiation angles', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({
      differentiationAngles: ['Better UX', 'Lower price'],
    });

    const prompt = buildGTMPrompt(problem, gaps);

    expect(prompt).toContain('Better UX; Lower price');
  });

  it('covers all launch phases', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();

    const prompt = buildGTMPrompt(problem, gaps);

    expect(prompt).toContain('Pre-Launch');
    expect(prompt).toContain('Launch');
    expect(prompt).toContain('Post-Launch');
    expect(prompt).toContain('First 10 Customers');
  });

  it('requests specific channel recommendations', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();

    const prompt = buildGTMPrompt(problem, gaps);

    expect(prompt).toContain('subreddits');
    expect(prompt).toContain('HN strategy');
  });
});

describe('buildRiskPrompt', () => {
  it('includes competition score', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ competitionScore: 75 });

    const prompt = buildRiskPrompt(problem, gaps);

    expect(prompt).toContain('**Competition level:** 75/100');
  });

  it('includes competitor names', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({
      existingSolutions: [
        { name: 'Competitor A', url: '', description: '', pricing: '', strengths: [], weaknesses: [] },
        { name: 'Competitor B', url: '', description: '', pricing: '', strengths: [], weaknesses: [] },
      ],
    });

    const prompt = buildRiskPrompt(problem, gaps);

    expect(prompt).toContain('**Competitors:** Competitor A, Competitor B');
  });

  it('covers all risk categories', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();

    const prompt = buildRiskPrompt(problem, gaps);

    expect(prompt).toContain('Market Risks');
    expect(prompt).toContain('Technical Risks');
    expect(prompt).toContain('Business Risks');
    expect(prompt).toContain('Execution Risks');
  });

  it('requests likelihood and impact ratings', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis();

    const prompt = buildRiskPrompt(problem, gaps);

    expect(prompt).toContain('Likelihood');
    expect(prompt).toContain('Impact');
    expect(prompt).toContain('Mitigation');
  });

  it('handles no competitors gracefully', () => {
    const problem = createMockScoredProblem();
    const gaps = createMockGapAnalysis({ existingSolutions: [] });

    const prompt = buildRiskPrompt(problem, gaps);

    expect(prompt).toContain('**Competitors:** Unknown');
  });
});

describe('parseJsonResponse', () => {
  it('parses valid JSON', () => {
    const json = '{"name": "TestApp", "tagline": "Test your apps"}';
    const result = parseJsonResponse<{ name: string; tagline: string }>(json);

    expect(result).toEqual({ name: 'TestApp', tagline: 'Test your apps' });
  });

  it('strips markdown json code blocks', () => {
    const json = '```json\n{"value": 42}\n```';
    const result = parseJsonResponse<{ value: number }>(json);

    expect(result).toEqual({ value: 42 });
  });

  it('strips generic code blocks', () => {
    const json = '```\n{"value": "test"}\n```';
    const result = parseJsonResponse<{ value: string }>(json);

    expect(result).toEqual({ value: 'test' });
  });

  it('handles whitespace around JSON', () => {
    const json = '  \n  {"key": "value"}  \n  ';
    const result = parseJsonResponse<{ key: string }>(json);

    expect(result).toEqual({ key: 'value' });
  });

  it('returns null for invalid JSON', () => {
    const invalid = 'This is not JSON at all';
    const result = parseJsonResponse(invalid);

    expect(result).toBeNull();
  });

  it('returns null for partial JSON', () => {
    const partial = '{"incomplete": ';
    const result = parseJsonResponse(partial);

    expect(result).toBeNull();
  });

  it('handles nested objects', () => {
    const json = '{"outer": {"inner": [1, 2, 3]}}';
    const result = parseJsonResponse<{ outer: { inner: number[] } }>(json);

    expect(result).toEqual({ outer: { inner: [1, 2, 3] } });
  });

  it('handles arrays', () => {
    const json = '[{"id": 1}, {"id": 2}]';
    const result = parseJsonResponse<Array<{ id: number }>>(json);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('handles JSON with markdown code blocks and surrounding text', () => {
    // The function strips code blocks but doesn't extract JSON from arbitrary text
    const json = '```json\n{"data": true}\n```';
    const result = parseJsonResponse<{ data: boolean }>(json);

    expect(result).toEqual({ data: true });
  });

  it('recovers truncated JSON with unclosed braces', () => {
    const truncated = '{"name": "TestApp", "tagline": "Great app"';
    const result = parseJsonResponse<{ name: string; tagline: string }>(truncated);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('TestApp');
    expect(result!.tagline).toBe('Great app');
  });

  it('recovers truncated JSON array with unclosed brackets', () => {
    const truncated = '[{"id": "p1", "name": "App1"}, {"id": "p2", "name": "App2"}';
    const result = parseJsonResponse<Array<{ id: string; name: string }>>(truncated);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });

  it('recovers JSON with trailing comma', () => {
    const truncated = '{"name": "TestApp", "features": ["a", "b"],';
    const result = parseJsonResponse<{ name: string; features: string[] }>(truncated);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('TestApp');
  });
});

describe('effortToString', () => {
  it('converts weekend to readable string', () => {
    expect(effortToString('weekend')).toBe('a weekend hackathon (2-3 days)');
  });

  it('converts week to readable string', () => {
    expect(effortToString('week')).toBe('a focused week (5-7 days)');
  });

  it('converts month to readable string', () => {
    expect(effortToString('month')).toBe('a dedicated month (4 weeks)');
  });

  it('converts quarter to readable string', () => {
    expect(effortToString('quarter')).toBe('a full quarter (3 months)');
  });

  it('handles all EffortLevel types', () => {
    const levels: EffortLevel[] = ['weekend', 'week', 'month', 'quarter'];

    levels.forEach(level => {
      const result = effortToString(level);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe('scoreToEffortLevel', () => {
  it('returns weekend for low effort scores', () => {
    // effort = timeToMvp * technicalComplexity
    // weekend: effort <= 6
    expect(scoreToEffortLevel({ timeToMvp: 2, technicalComplexity: 2 })).toBe('weekend'); // 4
    expect(scoreToEffortLevel({ timeToMvp: 2, technicalComplexity: 3 })).toBe('weekend'); // 6
    expect(scoreToEffortLevel({ timeToMvp: 1, technicalComplexity: 6 })).toBe('weekend'); // 6
  });

  it('returns week for medium-low effort scores', () => {
    // week: 6 < effort <= 16
    expect(scoreToEffortLevel({ timeToMvp: 3, technicalComplexity: 3 })).toBe('week'); // 9
    expect(scoreToEffortLevel({ timeToMvp: 4, technicalComplexity: 4 })).toBe('week'); // 16
    expect(scoreToEffortLevel({ timeToMvp: 2, technicalComplexity: 8 })).toBe('week'); // 16
  });

  it('returns month for medium-high effort scores', () => {
    // month: 16 < effort <= 36
    expect(scoreToEffortLevel({ timeToMvp: 5, technicalComplexity: 4 })).toBe('month'); // 20
    expect(scoreToEffortLevel({ timeToMvp: 6, technicalComplexity: 6 })).toBe('month'); // 36
  });

  it('returns quarter for high effort scores', () => {
    // quarter: effort > 36
    expect(scoreToEffortLevel({ timeToMvp: 7, technicalComplexity: 6 })).toBe('quarter'); // 42
    expect(scoreToEffortLevel({ timeToMvp: 10, technicalComplexity: 10 })).toBe('quarter'); // 100
  });

  it('handles boundary values correctly', () => {
    // Exact boundaries
    expect(scoreToEffortLevel({ timeToMvp: 6, technicalComplexity: 1 })).toBe('weekend'); // 6 - boundary
    expect(scoreToEffortLevel({ timeToMvp: 7, technicalComplexity: 1 })).toBe('week'); // 7 - just above
    expect(scoreToEffortLevel({ timeToMvp: 16, technicalComplexity: 1 })).toBe('week'); // 16 - boundary
    expect(scoreToEffortLevel({ timeToMvp: 17, technicalComplexity: 1 })).toBe('month'); // 17 - just above
    expect(scoreToEffortLevel({ timeToMvp: 36, technicalComplexity: 1 })).toBe('month'); // 36 - boundary
    expect(scoreToEffortLevel({ timeToMvp: 37, technicalComplexity: 1 })).toBe('quarter'); // 37 - just above
  });

  it('handles zero values', () => {
    expect(scoreToEffortLevel({ timeToMvp: 0, technicalComplexity: 5 })).toBe('weekend'); // 0
    expect(scoreToEffortLevel({ timeToMvp: 5, technicalComplexity: 0 })).toBe('weekend'); // 0
  });
});
