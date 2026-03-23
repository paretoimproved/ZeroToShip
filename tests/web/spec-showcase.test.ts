import { describe, it, expect } from 'vitest';
import { sampleAgentSpec } from '../../web/lib/sampleSpec';

describe('Spec showcase page data', () => {
  const specsBySlug: Record<string, typeof sampleAgentSpec> = {
    shipwatch: sampleAgentSpec,
  };

  it('resolves shipwatch slug to sample spec', () => {
    expect(specsBySlug['shipwatch']).toBeDefined();
    expect(specsBySlug['shipwatch'].projectName).toBeTruthy();
  });

  it('returns undefined for unknown slugs', () => {
    expect(specsBySlug['unknown']).toBeUndefined();
  });

  it('sample spec has required fields for showcase', () => {
    const spec = sampleAgentSpec;
    expect(spec.projectName).toBeTruthy();
    expect(spec.problem).toBeTruthy();
    expect(spec.evidence).toBeDefined();
    expect(spec.evidence.sourceCount).toBeGreaterThan(0);
    expect(spec.evidence.signalScore).toBeGreaterThan(0);
    expect(spec.evidence.trend).toBeTruthy();
    expect(spec.userStories).toBeDefined();
    expect(spec.technicalArchitecture).toBeDefined();
  });

  it('sample spec evidence is valid for provenance display', () => {
    const { evidence } = sampleAgentSpec;
    expect(evidence.sourceCount).toBe(12);
    expect(evidence.signalScore).toBe(87);
    expect(['rising', 'stable', 'falling']).toContain(evidence.trend);
  });
});
