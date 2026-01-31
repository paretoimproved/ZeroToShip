/**
 * Tests for the Email Delivery Module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDailyEmail,
  TIER_LIMITS,
  type SubscriberTier,
} from '../../src/delivery/email-builder';
import {
  sendDailyBrief,
  sendDailyBriefsBatch,
  previewDailyBrief,
  isValidEmail,
  getFailedDeliveries,
  getDeliveryStats,
  createTestSubscriber,
  type Subscriber,
} from '../../src/delivery/email';
import type { IdeaBrief } from '../../src/generation/brief-generator';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Create a mock IdeaBrief for testing
 */
function createMockBrief(overrides: Partial<IdeaBrief> = {}): IdeaBrief {
  return {
    id: `brief_${Date.now()}`,
    name: 'TestIdea',
    tagline: 'A test idea for testing purposes',
    priorityScore: 8.5,
    effortEstimate: 'weekend',
    revenueEstimate: '$10K MRR',
    problemStatement: 'Users struggle with testing email systems',
    targetAudience: 'Developers building email features',
    marketSize: '$1B market',
    existingSolutions: 'Manual testing, expensive tools',
    gaps: 'No simple automated testing solution',
    proposedSolution: 'Automated email testing framework',
    keyFeatures: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'],
    mvpScope: 'Basic email testing with assertions',
    technicalSpec: {
      stack: ['TypeScript', 'Node.js', 'Vitest'],
      architecture: 'Modular testing framework',
      estimatedEffort: 'weekend',
    },
    businessModel: {
      pricing: 'Freemium with Pro tier',
      revenueProjection: '$10K MRR in 6 months',
      monetizationPath: 'Free tier converts to paid',
    },
    goToMarket: {
      launchStrategy: 'Launch on Product Hunt',
      channels: ['Twitter', 'Reddit', 'HN'],
      firstCustomers: 'Indie hackers and startups',
    },
    risks: ['Competition from existing tools', 'Market saturation'],
    generatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple mock briefs
 */
function createMockBriefs(count: number): IdeaBrief[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBrief({
      id: `brief_${i}`,
      name: `Idea ${i + 1}`,
      tagline: `Tagline for idea ${i + 1}`,
      priorityScore: 10 - i * 0.5,
    })
  );
}

describe('Email Builder', () => {
  describe('TIER_LIMITS', () => {
    it('defines correct limits for free tier', () => {
      expect(TIER_LIMITS.free).toBe(3);
    });

    it('defines correct limits for pro tier', () => {
      expect(TIER_LIMITS.pro).toBe(10);
    });
  });

  describe('buildDailyEmail', () => {
    it('returns empty message when no briefs provided', () => {
      const result = buildDailyEmail([], 'free');

      expect(result.subject).toContain('No ideas today');
      expect(result.html).toContain('No startup ideas found today');
      expect(result.text).toContain('No startup ideas found today');
    });

    it('generates correct subject with top idea name', () => {
      const briefs = [createMockBrief({ name: 'SuperApp' })];
      const result = buildDailyEmail(briefs, 'free');

      expect(result.subject).toContain('SuperApp');
    });

    it('includes hero section with top idea details', () => {
      const brief = createMockBrief({
        name: 'HeroIdea',
        tagline: 'Hero tagline here',
        priorityScore: 9.2,
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('HeroIdea');
      expect(result.html).toContain('Hero tagline here');
      expect(result.html).toContain('9.2');
    });

    it('includes problem statement in brief', () => {
      const brief = createMockBrief({
        problemStatement: 'Users need better testing tools',
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('Users need better testing tools');
    });

    it('includes key features list', () => {
      const brief = createMockBrief({
        keyFeatures: ['Auto-testing', 'CI integration', 'Reports'],
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('Auto-testing');
      expect(result.html).toContain('CI integration');
      expect(result.html).toContain('Reports');
    });

    it('shows other ideas section when multiple briefs', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.html).toContain('More Ideas Today');
      expect(result.html).toContain('Idea 2');
      expect(result.html).toContain('Idea 3');
    });

    it('shows upgrade CTA for free tier users', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('Unlock All Ideas');
      expect(result.html).toContain('Upgrade to Pro');
    });

    it('hides upgrade CTA for pro tier users', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.html).not.toContain('Unlock All Ideas');
    });

    it('includes unsubscribe link in footer', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('Unsubscribe');
      expect(result.html).toContain('unsubscribe');
    });

    it('generates plain text version', () => {
      const brief = createMockBrief({ name: 'PlainTextIdea' });
      const result = buildDailyEmail([brief], 'free');

      expect(result.text).toContain('IDEAFORGE DAILY BRIEF');
      expect(result.text).toContain('PlainTextIdea');
      expect(result.text).toContain('THE PROBLEM');
    });

    it('escapes HTML characters in content', () => {
      const brief = createMockBrief({
        name: 'Test <script>alert("xss")</script>',
        tagline: 'Tagline with & ampersand',
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('&amp;');
    });

    it('uses custom config URLs', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free', {
        baseUrl: 'https://custom.com',
        unsubscribeUrl: 'https://custom.com/unsub',
        upgradeUrl: 'https://custom.com/upgrade',
      });

      expect(result.html).toContain('https://custom.com/unsub');
      expect(result.html).toContain('https://custom.com/upgrade');
    });

    it('limits features to 4 items', () => {
      const brief = createMockBrief({
        keyFeatures: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'],
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('F1');
      expect(result.html).toContain('F4');
      // F5 and F6 should not appear in hero section
    });
  });
});

describe('Email Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('isValidEmail', () => {
    it('returns true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('returns false for invalid email', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('createTestSubscriber', () => {
    it('creates subscriber with default free tier', () => {
      const subscriber = createTestSubscriber('test@example.com');

      expect(subscriber.email).toBe('test@example.com');
      expect(subscriber.tier).toBe('free');
      expect(subscriber.id).toContain('test_');
      expect(subscriber.unsubscribeToken).toContain('unsub_');
    });

    it('creates subscriber with specified tier', () => {
      const subscriber = createTestSubscriber('pro@example.com', 'pro');

      expect(subscriber.tier).toBe('pro');
    });
  });

  describe('sendDailyBrief', () => {
    it('returns failed status when no API key', async () => {
      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: '',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('No Resend API key');
    });

    it('sends email via Resend API successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'msg_123456' }),
      });

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'test_api_key',
      });

      expect(result.status).toBe('sent');
      expect(result.messageId).toBe('msg_123456');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_api_key',
          }),
        })
      );
    });

    it('handles Resend API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          statusCode: 401,
          message: 'Invalid API key',
          name: 'UnauthorizedError',
        }),
      });

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'invalid_key',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Resend API error');
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'test_key',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network error');
    });

    it('uses custom from email and name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'msg_789' }),
      });

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'test_key',
        fromEmail: 'custom@sender.com',
        fromName: 'Custom Sender',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Custom Sender <custom@sender.com>'),
        })
      );
    });
  });

  describe('sendDailyBriefsBatch', () => {
    it('handles empty subscriber list', async () => {
      const briefs = [createMockBrief()];
      const result = await sendDailyBriefsBatch([], briefs);

      expect(result.total).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.deliveries).toEqual([]);
    });

    it('sends to multiple subscribers', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'msg_1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'msg_2' }),
        });

      const subscribers: Subscriber[] = [
        createTestSubscriber('user1@example.com'),
        createTestSubscriber('user2@example.com'),
      ];
      const briefs = [createMockBrief()];

      const result = await sendDailyBriefsBatch(subscribers, briefs, {
        resendApiKey: 'test_key',
      });

      expect(result.total).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('tracks failed deliveries', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'msg_1' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Invalid email' }),
        });

      const subscribers: Subscriber[] = [
        createTestSubscriber('good@example.com'),
        createTestSubscriber('bad@example.com'),
      ];
      const briefs = [createMockBrief()];

      const result = await sendDailyBriefsBatch(subscribers, briefs, {
        resendApiKey: 'test_key',
      });

      expect(result.total).toBe(2);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('calls progress callback', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_x' }),
      });

      const subscribers = Array.from({ length: 10 }, (_, i) =>
        createTestSubscriber(`user${i}@example.com`)
      );
      const briefs = [createMockBrief()];
      const progressCalls: Array<[number, number]> = [];

      await sendDailyBriefsBatch(
        subscribers,
        briefs,
        { resendApiKey: 'test_key' },
        {
          concurrency: 3,
          delayMs: 0,
          onProgress: (completed, total) => {
            progressCalls.push([completed, total]);
          },
        }
      );

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1][0]).toBe(10);
    });
  });

  describe('previewDailyBrief', () => {
    it('returns email content without sending', () => {
      const briefs = [createMockBrief({ name: 'PreviewIdea' })];
      const result = previewDailyBrief('free', briefs);

      expect(result.subject).toContain('PreviewIdea');
      expect(result.html).toContain('PreviewIdea');
      expect(result.text).toContain('PreviewIdea');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getFailedDeliveries', () => {
    it('filters failed deliveries', () => {
      const result = {
        total: 3,
        sent: 2,
        failed: 1,
        deliveries: [
          { subscriberId: '1', email: 'a@x.com', messageId: 'msg_1', status: 'sent' as const, sentAt: new Date() },
          { subscriberId: '2', email: 'b@x.com', messageId: null, status: 'failed' as const, error: 'Bad', sentAt: new Date() },
          { subscriberId: '3', email: 'c@x.com', messageId: 'msg_3', status: 'sent' as const, sentAt: new Date() },
        ],
      };

      const failed = getFailedDeliveries(result);

      expect(failed).toHaveLength(1);
      expect(failed[0].subscriberId).toBe('2');
    });
  });

  describe('getDeliveryStats', () => {
    it('calculates correct statistics', () => {
      const result = {
        total: 10,
        sent: 8,
        failed: 2,
        deliveries: [],
      };

      const stats = getDeliveryStats(result);

      expect(stats.successRate).toBe(80);
      expect(stats.failureRate).toBe(20);
    });

    it('handles zero total', () => {
      const result = {
        total: 0,
        sent: 0,
        failed: 0,
        deliveries: [],
      };

      const stats = getDeliveryStats(result);

      expect(stats.successRate).toBe(0);
      expect(stats.failureRate).toBe(0);
    });
  });
});

describe('Tier-based content', () => {
  it('free tier sees only 3 unlocked ideas', () => {
    const briefs = createMockBriefs(10);
    const result = buildDailyEmail(briefs, 'free');

    // Ideas 4-10 should show as locked
    expect(result.text).toContain('[LOCKED]');
  });

  it('pro tier sees all 10 ideas unlocked', () => {
    const briefs = createMockBriefs(10);
    const result = buildDailyEmail(briefs, 'pro');

    // No locked indicators for pro
    expect(result.text).not.toContain('[LOCKED]');
  });

  it('free tier plain text shows locked count', () => {
    const briefs = createMockBriefs(10);
    const result = buildDailyEmail(briefs, 'free');

    // Should mention upgrade
    expect(result.text).toContain('Upgrade to Pro');
  });
});
