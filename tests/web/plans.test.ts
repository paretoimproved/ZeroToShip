import { describe, it, expect } from 'vitest';
import { BASE_PLANS, FREE_FEATURES, PRO_FEATURES } from '../../web/lib/plans';

describe('Shared pricing plans', () => {
  it('has two plans: Free and Pro', () => {
    expect(BASE_PLANS).toHaveLength(2);
    expect(BASE_PLANS[0].name).toBe('Free');
    expect(BASE_PLANS[1].name).toBe('Pro');
  });

  it('free tier includes 1 agent-spec generation', () => {
    const specFeature = FREE_FEATURES.find(f => f.text.includes('agent-spec'));
    expect(specFeature).toBeDefined();
    expect(specFeature!.included).toBe(true);
    expect(specFeature!.text).toContain('1');
  });

  it('pro tier includes 30 agent-spec generations', () => {
    const specFeature = PRO_FEATURES.find(f => f.text.includes('agent-spec'));
    expect(specFeature).toBeDefined();
    expect(specFeature!.included).toBe(true);
    expect(specFeature!.text).toContain('30');
  });

  it('free plan is not highlighted, pro plan is', () => {
    expect(BASE_PLANS[0].highlighted).toBe(false);
    expect(BASE_PLANS[1].highlighted).toBe(true);
  });

  it('free plan costs $0, pro costs $19/month', () => {
    expect(BASE_PLANS[0].monthlyPrice).toBe(0);
    expect(BASE_PLANS[1].monthlyPrice).toBe(19);
  });
});
