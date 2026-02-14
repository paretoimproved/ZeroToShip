import { describe, expect, it } from 'vitest';
import type { GapAnalysis } from '../../../src/analysis/gap-analyzer';
import { mergeGapEnrichment, buildSkippedHandoffMeta } from '../../../src/generation/handoff/enrich-gap-analysis';

function makeGapAnalysis(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  return {
    problemId: 'p1',
    problemStatement: 'Need better onboarding',
    searchQueries: ['onboarding tool'],
    existingSolutions: [
      {
        name: 'CompA',
        url: 'https://a.example.com',
        description: 'A',
        pricing: '$',
        strengths: [],
        weaknesses: [],
      },
    ],
    gaps: ['gap-a'],
    marketOpportunity: 'medium',
    differentiationAngles: ['diff-a'],
    recommendation: 'ok',
    competitionScore: 10,
    analysisNotes: 'notes',
    analyzedAt: new Date('2026-02-14T00:00:00.000Z'),
    ...overrides,
  };
}

describe('mergeGapEnrichment', () => {
  it('merges and de-dupes competitors/gaps/differentiators and returns added counts', () => {
    const base = makeGapAnalysis();
    const { merged, meta } = mergeGapEnrichment(base, {
      competitors: [
        {
          name: 'CompA (dup)',
          url: 'https://a.example.com',
          description: 'dup',
          pricing: '$',
          strengths: [],
          weaknesses: [],
        },
        {
          name: 'CompB',
          url: 'https://b.example.com',
          description: 'b',
          pricing: '$',
          strengths: [],
          weaknesses: [],
        },
      ],
      gaps: ['gap-a', 'gap-b'],
      differentiationAngles: ['diff-b'],
      notes: 'extra',
    });

    expect(merged.existingSolutions.length).toBe(2);
    expect(merged.gaps).toEqual(['gap-a', 'gap-b']);
    expect(merged.differentiationAngles).toEqual(['diff-a', 'diff-b']);
    expect(meta.addedCompetitors).toBe(1);
    expect(meta.addedGaps).toBe(1);
    expect(meta.addedDifferentiators).toBe(1);
    expect(merged.analysisNotes).toContain('[handoff]');
  });
});

describe('buildSkippedHandoffMeta', () => {
  it('returns undefined for provider off', () => {
    expect(buildSkippedHandoffMeta('off', 'x')).toBeUndefined();
  });

  it('returns meta for provider mock/n8n', () => {
    const meta = buildSkippedHandoffMeta('mock', 'missing')!;
    expect(meta.provider).toBe('mock');
    expect(meta.status).toBe('skipped');
    expect(meta.reason).toBe('missing');
  });
});

