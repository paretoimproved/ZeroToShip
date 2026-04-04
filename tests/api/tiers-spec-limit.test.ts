import { describe, it, expect } from 'vitest';
import {
  SPEC_GENERATION_LIMITS,
  getMonthlySpecLimit,
  FEATURE_ACCESS,
  hasAccess,
} from '../../src/api/config/tiers';

describe('Free tier spec generation config', () => {
  it('allows free tier 1 spec/month', () => {
    expect(SPEC_GENERATION_LIMITS.free).toBe(1);
    expect(getMonthlySpecLimit('free')).toBe(1);
  });

  it('has generateSpec feature accessible by free tier', () => {
    expect(FEATURE_ACCESS['ideas.generateSpec'].minTier).toBe('free');
    expect(hasAccess('free', 'ideas.generateSpec')).toBe(true);
    expect(hasAccess('anonymous', 'ideas.generateSpec')).toBe(false);
  });

  it('distinguishes free exhausted from pro exhausted', () => {
    const freeLimit = getMonthlySpecLimit('free');
    const proLimit = getMonthlySpecLimit('pro');
    const isFreeExhausted = freeLimit < 30; // same logic as GenerateSpecCta
    const isProExhausted = proLimit >= 30;
    expect(isFreeExhausted).toBe(true);
    expect(isProExhausted).toBe(true);
  });
});
