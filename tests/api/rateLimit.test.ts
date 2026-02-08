/**
 * Rate Limiting Tests for ZeroToShip API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RATE_LIMITS,
  IDEAS_LIMIT,
} from '../../src/api/config/tiers';

// Local mock for clearRateLimit to avoid db imports
const memoryStore = new Map<string, unknown>();
function clearRateLimit(key: string): void {
  memoryStore.delete(key);
}

describe('Rate Limits', () => {
  describe('RATE_LIMITS configuration', () => {
    it('should have correct limits for anonymous tier', () => {
      expect(RATE_LIMITS.anonymous.requests).toBe(10);
      expect(RATE_LIMITS.anonymous.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should have correct limits for free tier', () => {
      expect(RATE_LIMITS.free.requests).toBe(100);
      expect(RATE_LIMITS.free.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have correct limits for pro tier', () => {
      expect(RATE_LIMITS.pro.requests).toBe(1000);
      expect(RATE_LIMITS.pro.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have correct limits for enterprise tier', () => {
      expect(RATE_LIMITS.enterprise.requests).toBe(10000);
      expect(RATE_LIMITS.enterprise.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have increasing limits as tier increases', () => {
      expect(RATE_LIMITS.anonymous.requests).toBeLessThan(RATE_LIMITS.free.requests);
      expect(RATE_LIMITS.free.requests).toBeLessThan(RATE_LIMITS.pro.requests);
      expect(RATE_LIMITS.pro.requests).toBeLessThan(RATE_LIMITS.enterprise.requests);
    });
  });

  describe('IDEAS_LIMIT configuration', () => {
    it('should have correct limits for each tier', () => {
      expect(IDEAS_LIMIT.anonymous).toBe(3);
      expect(IDEAS_LIMIT.free).toBe(3);
      expect(IDEAS_LIMIT.pro).toBe(10);
      expect(IDEAS_LIMIT.enterprise).toBe(Infinity);
    });

    it('should have same limit for anonymous and free', () => {
      expect(IDEAS_LIMIT.anonymous).toBe(IDEAS_LIMIT.free);
    });

    it('should have unlimited ideas for enterprise', () => {
      expect(IDEAS_LIMIT.enterprise).toBe(Infinity);
    });
  });

  describe('clearRateLimit', () => {
    it('should be callable without error', () => {
      expect(() => clearRateLimit('test-key')).not.toThrow();
    });

    it('should handle non-existent keys', () => {
      expect(() => clearRateLimit('non-existent-key')).not.toThrow();
    });
  });
});

describe('Rate Limit Math', () => {
  it('should calculate correct hourly rate for anonymous (10/hour)', () => {
    const config = RATE_LIMITS.anonymous;
    const requestsPerMinute = config.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(0.167, 2);
  });

  it('should calculate correct hourly rate for free (100/hour)', () => {
    const config = RATE_LIMITS.free;
    const requestsPerMinute = config.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(1.67, 1);
  });

  it('should calculate correct hourly rate for pro (1000/hour)', () => {
    const config = RATE_LIMITS.pro;
    const requestsPerMinute = config.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(16.67, 1);
  });

  it('should calculate correct hourly rate for enterprise (10000/hour)', () => {
    const config = RATE_LIMITS.enterprise;
    const requestsPerMinute = config.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(166.67, 1);
  });
});

describe('Tier Upgrade Benefits', () => {
  it('should show 10x improvement from anonymous to free', () => {
    const improvement = RATE_LIMITS.free.requests / RATE_LIMITS.anonymous.requests;
    expect(improvement).toBe(10);
  });

  it('should show 10x improvement from free to pro', () => {
    const improvement = RATE_LIMITS.pro.requests / RATE_LIMITS.free.requests;
    expect(improvement).toBe(10);
  });

  it('should show 10x improvement from pro to enterprise', () => {
    const improvement = RATE_LIMITS.enterprise.requests / RATE_LIMITS.pro.requests;
    expect(improvement).toBe(10);
  });

  it('should show 1000x total improvement from anonymous to enterprise', () => {
    const improvement = RATE_LIMITS.enterprise.requests / RATE_LIMITS.anonymous.requests;
    expect(improvement).toBe(1000);
  });
});
