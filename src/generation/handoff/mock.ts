import type { Competitor } from '../../analysis/competitor';
import type { GapEnrichmentRequest, GapEnrichmentResponse } from './contract';

function makeMockCompetitor(problemStatement: string): Competitor {
  const base = problemStatement.split(/\s+/).slice(0, 4).join(' ').trim() || 'Problem';
  return {
    name: `Mock${base.replace(/[^a-z0-9]/gi, '').slice(0, 10) || 'Co'}`,
    url: 'https://example.com/mock-competitor',
    description: `Synthetic competitor for: ${base}`,
    pricing: 'N/A',
    strengths: ['fast to evaluate'],
    weaknesses: ['not real market data'],
  };
}

export async function requestGapEnrichmentMock(
  req: GapEnrichmentRequest,
): Promise<{ ok: true; durationMs: number; response: GapEnrichmentResponse }> {
  const started = Date.now();
  const competitor = makeMockCompetitor(req.problemStatement);
  const durationMs = Date.now() - started;

  return {
    ok: true,
    durationMs,
    response: {
      ok: true,
      payload: {
        competitors: [competitor],
        gaps: [`Mock gap: ${req.problemStatement.slice(0, 80)}`],
        differentiationAngles: ['Mock differentiator: speed'],
        notes: 'Mock handoff provider used for testing/verification.',
      },
    },
  };
}

