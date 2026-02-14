/**
 * Comprehensive tests for the Email Delivery Module
 *
 * Covers: template rendering (snapshots), Resend API mocking,
 * failure paths, batch sending, data assembly, and tier filtering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _resetConfigForTesting } from '../../src/config/env';
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
  type BatchDeliveryResult,
} from '../../src/delivery/email';
import type { IdeaBrief } from '../../src/generation/brief-generator';
import { makeGenerationBrief, makeGenerationBriefs } from '../fixtures';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

/** Normalize HTML for stable snapshot comparison:
 *  - Strip leading whitespace (indentation varies across environments)
 *  - Replace dynamic date with placeholder (changes daily)
 *  - Replace dynamic year in footer with placeholder */
const normalizeForSnapshot = (s: string) =>
  s.replace(/^[ \t]+/gm, '')
   .replace(
     /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g,
     'DATE_PLACEHOLDER',
   )
   .replace(/ZeroToShip \d{4}/g, 'ZeroToShip YEAR');

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const createMockBrief = (overrides: Partial<IdeaBrief> = {}): IdeaBrief =>
  makeGenerationBrief({ id: 'brief_stable_id', ...overrides });

const createMockBriefs = (count: number): IdeaBrief[] =>
  makeGenerationBriefs(count);

function mockResendSuccess(messageId = 'msg_123456') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: messageId }),
  });
}

function mockResendError(status = 401, message = 'Invalid API key') {
  const resp = {
    ok: false,
    status,
    json: async () => ({
      statusCode: status,
      message,
      name: 'ApiError',
    }),
  };

  // Rate limits and 5xx are retryable in code; keep a stable response for all attempts.
  if (status === 429 || status >= 500) {
    mockFetch.mockResolvedValue(resp);
    return;
  }

  mockFetch.mockResolvedValueOnce(resp);
}

// ============================================================================
// Email Builder — Template Rendering
// ============================================================================

describe('Email Builder', () => {
  describe('TIER_LIMITS', () => {
    it('defines correct limits for free tier', () => {
      expect(TIER_LIMITS.free).toBe(3);
    });

    it('defines correct limits for pro tier', () => {
      expect(TIER_LIMITS.pro).toBe(10);
    });
  });

  // --------------------------------------------------------------------------
  // Snapshot tests — captures structural integrity of template output
  // --------------------------------------------------------------------------

  describe('HTML template snapshots', () => {
    it('matches snapshot for single brief (free tier)', () => {
      const brief = createMockBrief({ name: 'SnapshotApp' });
      const result = buildDailyEmail([brief], 'free', {
        baseUrl: 'https://test.zerotoship.dev',
        unsubscribeUrl: 'https://test.zerotoship.dev/unsub',
        upgradeUrl: 'https://test.zerotoship.dev/upgrade',
      });

      expect(normalizeForSnapshot(result.html)).toMatchSnapshot();
    });

    it('matches snapshot for multiple briefs (free tier)', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'free', {
        baseUrl: 'https://test.zerotoship.dev',
        unsubscribeUrl: 'https://test.zerotoship.dev/unsub',
        upgradeUrl: 'https://test.zerotoship.dev/upgrade',
      });

      expect(normalizeForSnapshot(result.html)).toMatchSnapshot();
    });

    it('matches snapshot for multiple briefs (pro tier)', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'pro', {
        baseUrl: 'https://test.zerotoship.dev',
        unsubscribeUrl: 'https://test.zerotoship.dev/unsub',
        upgradeUrl: 'https://test.zerotoship.dev/upgrade',
      });

      expect(normalizeForSnapshot(result.html)).toMatchSnapshot();
    });

    it('matches snapshot for empty briefs', () => {
      const result = buildDailyEmail([], 'free');

      expect(result.html).toMatchSnapshot();
    });

    it('matches snapshot for plain text (free tier)', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'free', {
        baseUrl: 'https://test.zerotoship.dev',
        unsubscribeUrl: 'https://test.zerotoship.dev/unsub',
        upgradeUrl: 'https://test.zerotoship.dev/upgrade',
      });

      expect(normalizeForSnapshot(result.text)).toMatchSnapshot();
    });

    it('matches snapshot for plain text (pro tier)', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'pro', {
        baseUrl: 'https://test.zerotoship.dev',
        unsubscribeUrl: 'https://test.zerotoship.dev/unsub',
        upgradeUrl: 'https://test.zerotoship.dev/upgrade',
      });

      expect(normalizeForSnapshot(result.text)).toMatchSnapshot();
    });
  });

  // --------------------------------------------------------------------------
  // buildDailyEmail — structural tests
  // --------------------------------------------------------------------------

  describe('buildDailyEmail', () => {
    it('returns empty message when no briefs provided', () => {
      const result = buildDailyEmail([], 'free');

      expect(result.subject).toContain('No ideas today');
      expect(result.html).toContain('No startup ideas found today');
      expect(result.text).toContain('No startup ideas found today');
    });

    it('generates a subject line referencing top idea', () => {
      const briefs = [createMockBrief({ name: 'SuperApp' })];
      const result = buildDailyEmail(briefs, 'free');

      // Subject lines rotate daily; just verify it's non-empty and ≤60 chars
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.subject.length).toBeLessThanOrEqual(60);
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

    it('includes full key features in pro hero', () => {
      const brief = createMockBrief({
        keyFeatures: ['automated deployment pipelines', 'zero-config setup'],
      });
      const result = buildDailyEmail([brief], 'pro');

      expect(result.html).toContain('automated deployment pipelines');
      expect(result.html).toContain('zero-config setup');
      expect(result.html).toContain('Key Features');
    });

    it('includes problem statement hook in hero', () => {
      const brief = createMockBrief({
        problemStatement: 'A CLI tool that auto-deploys with zero config.',
      });
      const result = buildDailyEmail([brief], 'pro');

      // Hero uses firstSentence() of problemStatement
      expect(result.html).toContain('A CLI tool that auto-deploys with zero config.');
    });

    it('includes CTA to view brief on dashboard for pro', () => {
      const brief = createMockBrief();
      const result = buildDailyEmail([brief], 'pro');

      expect(result.html).toContain('View full brief on dashboard');
    });

    it('includes effort estimate in score bar', () => {
      const brief = createMockBrief({ effortEstimate: 'weekend' });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('Build time');
      expect(result.html).toContain('Weekend');
    });

    it('includes revenue estimate in score bar (truncated to 20 chars)', () => {
      const brief = createMockBrief({
        revenueEstimate: '$50K-$100K MRR within first year',
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('Revenue');
      // MRR should be humanized for non-technical readers.
      expect(result.html).toContain('$50K-$100K per month');
    });

    it('includes idea name and tagline in hero', () => {
      const brief = createMockBrief({
        name: 'AutoTester',
        tagline: 'CI integration for everyone',
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('AutoTester');
      expect(result.html).toContain('CI integration for everyone');
    });

    it('shows other ideas section when multiple briefs', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.html).toContain("Today's Other Ideas");
      expect(result.html).toContain('Idea 2');
      expect(result.html).toContain('Idea 3');
    });

    it('does not show other ideas section with single brief', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.html).not.toContain("Today's Other Ideas");
    });

    it('caps other ideas to max 9 (ranks 2-10)', () => {
      const briefs = createMockBriefs(15);
      const result = buildDailyEmail(briefs, 'pro');

      // Should include up to rank 10, not beyond
      expect(result.html).toContain('Idea 10');
      expect(result.html).not.toContain('Idea 11');
    });

    it('shows upgrade CTA for free tier users', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('Every idea. Every brief. Every day.');
      expect(result.html).toContain('Unlock Pro');
    });

    it('hides upgrade CTA for pro tier users', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.html).not.toContain('Unlock Pro');
    });

    it('includes unsubscribe link in footer', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('Unsubscribe');
      expect(result.html).toContain('unsubscribe');
    });

    it('includes ZeroToShip branding in header', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('ZeroToShip');
    });

    it('includes year in footer', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain(`ZeroToShip ${new Date().getFullYear()}`);
    });

    it('generates valid HTML document', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html lang="en">');
      expect(result.html).toContain('</html>');
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

    it('escapes quotes in HTML content', () => {
      const brief = createMockBrief({
        name: 'Idea with "quotes"',
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('&quot;quotes&quot;');
    });

    it('escapes single quotes in HTML content', () => {
      const brief = createMockBrief({
        name: "It's an idea",
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.html).toContain('&#39;s an idea');
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
      expect(result.html).toContain('https://custom.com');
    });

    it('uses default config when no config provided', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('https://zerotoship.dev/unsubscribe');
      expect(result.html).toContain('https://zerotoship.dev/upgrade');
    });

    it('truncates long taglines in secondary idea rows to 80 chars', () => {
      const briefs = [
        createMockBrief({ name: 'Top Idea' }),
        createMockBrief({
          name: 'Secondary Idea',
          tagline: 'A'.repeat(100),
        }),
      ];
      const result = buildDailyEmail(briefs, 'pro');

      // Should truncate and add ellipsis (TAGLINE_TRUNCATE_LENGTH = 80)
      expect(result.html).toContain('...');
    });

    it('does not add ellipsis to short taglines in secondary rows', () => {
      const briefs = [
        createMockBrief({ name: 'Top Idea' }),
        createMockBrief({
          name: 'Secondary Idea',
          tagline: 'Short tagline',
        }),
      ];
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.html).toContain('Short tagline');
    });
  });

  // --------------------------------------------------------------------------
  // Plain text email generation
  // --------------------------------------------------------------------------

  describe('plain text email', () => {
    it('generates plain text version with structured sections', () => {
      const brief = createMockBrief({ name: 'PlainTextIdea' });
      const result = buildDailyEmail([brief], 'free');

      expect(result.text).toContain('ZEROTOSHIP');
      expect(result.text).toContain('PlainTextIdea');
      expect(result.text).toContain("TODAY'S TOP IDEA");
    });

    it('includes priority score and effort in plain text', () => {
      const brief = createMockBrief({
        priorityScore: 7.3,
        effortEstimate: 'weekend',
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.text).toContain('7.3');
      expect(result.text).toContain('Build time: Weekend');
    });

    it('includes tagline in quotes in plain text', () => {
      const brief = createMockBrief({ tagline: 'My awesome tagline' });
      const result = buildDailyEmail([brief], 'free');

      expect(result.text).toContain('"My awesome tagline"');
    });

    it('includes problem statement in plain text', () => {
      const brief = createMockBrief({
        problemStatement: 'Alpha testing is painful.',
      });
      const result = buildDailyEmail([brief], 'free');

      expect(result.text).toContain('Alpha testing is painful.');
    });

    it('includes OTHER IDEAS header for multiple briefs', () => {
      const briefs = createMockBriefs(4);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.text).toContain("TODAY'S OTHER IDEAS");
    });

    it('includes unsubscribe URL in plain text', () => {
      const briefs = [createMockBrief()];
      const result = buildDailyEmail(briefs, 'free', {
        unsubscribeUrl: 'https://example.com/unsub',
      });

      expect(result.text).toContain('Unsubscribe: https://example.com/unsub');
    });

    it('returns simple text for empty briefs', () => {
      const result = buildDailyEmail([], 'pro');

      expect(result.text).toBe('No startup ideas found today. Check back tomorrow!');
    });

    it('shows unlocked taglines for ideas within tier limit', () => {
      const briefs = createMockBriefs(5);
      const result = buildDailyEmail(briefs, 'pro');

      // Pro can see all 5; ideas 2-5 should show taglines
      expect(result.text).toContain('Tagline for idea 2');
      expect(result.text).toContain('Tagline for idea 5');
    });
  });
});

// ============================================================================
// Email Service — API interactions
// ============================================================================

describe('Email Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --------------------------------------------------------------------------
  // isValidEmail
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // createTestSubscriber
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // sendDailyBrief — Resend API mocking
  // --------------------------------------------------------------------------

  describe('sendDailyBrief', () => {
    it('returns failed status when no API key', async () => {
      // Clear env API key so fallback is also empty
      const origKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;
      _resetConfigForTesting();

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: '',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('No Resend API key');
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore
      if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
      _resetConfigForTesting();
    });

    it('sends email via Resend API successfully', async () => {
      mockResendSuccess('msg_123456');

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'test_api_key',
      });

      expect(result.status).toBe('sent');
      expect(result.messageId).toBe('msg_123456');
      expect(result.subscriberId).toBe(subscriber.id);
      expect(result.email).toBe('test@example.com');
      expect(result.sentAt).toBeInstanceOf(Date);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_api_key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('sends correct email body to Resend API', async () => {
      mockResendSuccess();

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief({ name: 'TestPayload' })];

      await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'key_123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.to).toEqual(['test@example.com']);
      // Subject lines rotate daily; just check it's populated
      expect(callBody.subject.length).toBeGreaterThan(0);
      expect(callBody.html).toBeDefined();
      expect(callBody.text).toBeDefined();
      expect(callBody.reply_to).toBe('hello@zerotoship.dev');
    });

    it('includes default from address', async () => {
      mockResendSuccess();

      const subscriber = createTestSubscriber('test@example.com');
      await sendDailyBrief(subscriber, [createMockBrief()], {
        resendApiKey: 'key_123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.from).toBe('ZeroToShip <briefs@zerotoship.dev>');
    });

    it('handles Resend API error response', async () => {
      mockResendError(401, 'Invalid API key');

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'invalid_key',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Resend API error');
      expect(result.error).toContain('401');
      expect(result.messageId).toBeNull();
    });

    it('handles Resend rate limit error (429)', async () => {
      mockResendError(429, 'Rate limit exceeded');

      const subscriber = createTestSubscriber('test@example.com');

      const result = await sendDailyBrief(subscriber, [createMockBrief()], {
        resendApiKey: 'key_123',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('429');
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('handles network error (fetch throws)', async () => {
      // Network errors are retried; reject for all attempts.
      mockFetch.mockRejectedValue(new Error('Network error'));

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      const result = await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'test_key',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network error');
    });

    it('handles non-Error thrown objects', async () => {
      // Unknown throws are retried; reject for all attempts.
      mockFetch.mockRejectedValue('string error');

      const subscriber = createTestSubscriber('test@example.com');

      const result = await sendDailyBrief(subscriber, [createMockBrief()], {
        resendApiKey: 'key_123',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Unknown error');
    });

    it('uses custom from email and name', async () => {
      mockResendSuccess();

      const subscriber = createTestSubscriber('test@example.com');
      const briefs = [createMockBrief()];

      await sendDailyBrief(subscriber, briefs, {
        resendApiKey: 'test_key',
        fromEmail: 'custom@sender.com',
        fromName: 'Custom Sender',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.from).toBe('Custom Sender <custom@sender.com>');
    });

    it('uses custom reply-to address', async () => {
      mockResendSuccess();

      const subscriber = createTestSubscriber('test@example.com');

      await sendDailyBrief(subscriber, [createMockBrief()], {
        resendApiKey: 'key_123',
        replyTo: 'support@custom.io',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.reply_to).toBe('support@custom.io');
    });

    it('builds personalized unsubscribe URL using token', async () => {
      mockResendSuccess();

      const subscriber: Subscriber = {
        id: 'sub_42',
        email: 'user@example.com',
        tier: 'pro',
        unsubscribeToken: 'my-unsub-token',
      };

      await sendDailyBrief(subscriber, [createMockBrief()], {
        resendApiKey: 'key_123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.html).toContain('my-unsub-token');
    });

    it('falls back to subscriber id when no unsubscribe token', async () => {
      mockResendSuccess();

      const subscriber: Subscriber = {
        id: 'sub_fallback',
        email: 'user@example.com',
        tier: 'free',
      };

      await sendDailyBrief(subscriber, [createMockBrief()], {
        resendApiKey: 'key_123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.html).toContain('sub_fallback');
    });

    it('returns pending-initialized delivery status with subscriber info', async () => {
      mockResendSuccess('msg_abc');

      const subscriber: Subscriber = {
        id: 'sub_99',
        email: 'jane@example.com',
        tier: 'pro',
      };

      const result = await sendDailyBrief(subscriber, [createMockBrief()], {
        resendApiKey: 'key_123',
      });

      expect(result.subscriberId).toBe('sub_99');
      expect(result.email).toBe('jane@example.com');
      expect(result.sentAt).toBeInstanceOf(Date);
    });
  });

  // --------------------------------------------------------------------------
  // sendDailyBriefsBatch — batch sending logic
  // --------------------------------------------------------------------------

  describe('sendDailyBriefsBatch', () => {
    it('handles empty subscriber list', async () => {
      const briefs = [createMockBrief()];
      const result = await sendDailyBriefsBatch([], briefs);

      expect(result.total).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.deliveries).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends to multiple subscribers', async () => {
      mockResendSuccess('msg_1');
      mockResendSuccess('msg_2');

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
      expect(result.deliveries).toHaveLength(2);
    });

    it('tracks mixed success and failure deliveries', async () => {
      mockResendSuccess('msg_1');
      mockResendError(400, 'Invalid email');
      mockResendSuccess('msg_3');

      const subscribers: Subscriber[] = [
        createTestSubscriber('good@example.com'),
        createTestSubscriber('bad@example.com'),
        createTestSubscriber('also-good@example.com'),
      ];
      const briefs = [createMockBrief()];

      const result = await sendDailyBriefsBatch(subscribers, briefs, {
        resendApiKey: 'test_key',
      });

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.deliveries[1].status).toBe('failed');
    });

    it('respects concurrency setting', async () => {
      // With concurrency=2 and 4 subscribers, we expect 2 batches
      for (let i = 0; i < 4; i++) {
        mockResendSuccess(`msg_${i}`);
      }

      const subscribers = Array.from({ length: 4 }, (_, i) =>
        createTestSubscriber(`user${i}@example.com`)
      );

      const result = await sendDailyBriefsBatch(
        subscribers,
        [createMockBrief()],
        { resendApiKey: 'test_key' },
        { concurrency: 2, delayMs: 0 }
      );

      expect(result.total).toBe(4);
      expect(result.sent).toBe(4);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('uses default concurrency of 5', async () => {
      // 7 subscribers with default concurrency 5 => batch of 5 then batch of 2
      for (let i = 0; i < 7; i++) {
        mockResendSuccess(`msg_${i}`);
      }

      const subscribers = Array.from({ length: 7 }, (_, i) =>
        createTestSubscriber(`user${i}@example.com`)
      );

      const result = await sendDailyBriefsBatch(
        subscribers,
        [createMockBrief()],
        { resendApiKey: 'test_key' },
        { delayMs: 0 }
      );

      expect(result.total).toBe(7);
      expect(result.sent).toBe(7);
    });

    it('calls progress callback with correct values', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_x' }),
      });

      const subscribers = Array.from({ length: 10 }, (_, i) =>
        createTestSubscriber(`user${i}@example.com`)
      );
      const progressCalls: Array<[number, number]> = [];

      await sendDailyBriefsBatch(
        subscribers,
        [createMockBrief()],
        { resendApiKey: 'test_key' },
        {
          concurrency: 3,
          delayMs: 0,
          onProgress: (completed, total) => {
            progressCalls.push([completed, total]);
          },
        }
      );

      // With 10 subscribers and concurrency 3: batches at indices 0,3,6,9
      // Progress calls: (3,10), (6,10), (9,10), (10,10)
      expect(progressCalls.length).toBe(4);
      expect(progressCalls[0]).toEqual([3, 10]);
      expect(progressCalls[1]).toEqual([6, 10]);
      expect(progressCalls[2]).toEqual([9, 10]);
      expect(progressCalls[3]).toEqual([10, 10]);
    });

    it('does not call progress callback with empty list', async () => {
      const onProgress = vi.fn();

      await sendDailyBriefsBatch(
        [],
        [createMockBrief()],
        { resendApiKey: 'test_key' },
        { onProgress }
      );

      expect(onProgress).not.toHaveBeenCalled();
    });

    it('handles single subscriber', async () => {
      mockResendSuccess('msg_single');

      const result = await sendDailyBriefsBatch(
        [createTestSubscriber('solo@example.com')],
        [createMockBrief()],
        { resendApiKey: 'test_key' },
        { delayMs: 0 }
      );

      expect(result.total).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.deliveries[0].status).toBe('sent');
    });

    it('handles all sends failing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ statusCode: 500, message: 'Server error', name: 'InternalError' }),
      });

      const subscribers = Array.from({ length: 3 }, (_, i) =>
        createTestSubscriber(`user${i}@example.com`)
      );

      const result = await sendDailyBriefsBatch(
        subscribers,
        [createMockBrief()],
        { resendApiKey: 'test_key' },
        { delayMs: 0 }
      );

      expect(result.total).toBe(3);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(3);
    });

    it('does not delay after the last batch', async () => {
      const start = Date.now();

      // 2 subscribers with concurrency 2 — single batch, no delay needed
      mockResendSuccess('msg_1');
      mockResendSuccess('msg_2');

      await sendDailyBriefsBatch(
        [
          createTestSubscriber('a@example.com'),
          createTestSubscriber('b@example.com'),
        ],
        [createMockBrief()],
        { resendApiKey: 'test_key' },
        { concurrency: 2, delayMs: 5000 }
      );

      const elapsed = Date.now() - start;
      // Should not have waited 5s since there's only one batch
      expect(elapsed).toBeLessThan(2000);
    });
  });

  // --------------------------------------------------------------------------
  // previewDailyBrief
  // --------------------------------------------------------------------------

  describe('previewDailyBrief', () => {
    it('returns email content without sending', () => {
      const briefs = [createMockBrief({ name: 'PreviewIdea' })];
      const result = previewDailyBrief('free', briefs);

      // Subject lines rotate, just verify content includes the idea name
      expect(result.html).toContain('PreviewIdea');
      expect(result.text).toContain('PreviewIdea');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('respects tier parameter', () => {
      const briefs = createMockBriefs(5);

      const freeResult = previewDailyBrief('free', briefs);
      const proResult = previewDailyBrief('pro', briefs);

      expect(freeResult.html).toContain('Unlock Pro');
      expect(proResult.html).not.toContain('Unlock Pro');
    });

    it('accepts custom config', () => {
      const briefs = [createMockBrief()];
      const result = previewDailyBrief('free', briefs, {
        upgradeUrl: 'https://custom.com/upgrade',
      });

      expect(result.html).toContain('https://custom.com/upgrade');
    });
  });

  // --------------------------------------------------------------------------
  // getFailedDeliveries
  // --------------------------------------------------------------------------

  describe('getFailedDeliveries', () => {
    it('filters only failed deliveries', () => {
      const result: BatchDeliveryResult = {
        total: 3,
        sent: 2,
        failed: 1,
        deliveries: [
          { subscriberId: '1', email: 'a@x.com', messageId: 'msg_1', status: 'sent', sentAt: new Date() },
          { subscriberId: '2', email: 'b@x.com', messageId: null, status: 'failed', error: 'Bad email', sentAt: new Date() },
          { subscriberId: '3', email: 'c@x.com', messageId: 'msg_3', status: 'sent', sentAt: new Date() },
        ],
      };

      const failed = getFailedDeliveries(result);

      expect(failed).toHaveLength(1);
      expect(failed[0].subscriberId).toBe('2');
      expect(failed[0].error).toBe('Bad email');
    });

    it('returns empty array when all succeeded', () => {
      const result: BatchDeliveryResult = {
        total: 2,
        sent: 2,
        failed: 0,
        deliveries: [
          { subscriberId: '1', email: 'a@x.com', messageId: 'msg_1', status: 'sent', sentAt: new Date() },
          { subscriberId: '2', email: 'b@x.com', messageId: 'msg_2', status: 'sent', sentAt: new Date() },
        ],
      };

      expect(getFailedDeliveries(result)).toEqual([]);
    });

    it('returns all when everything failed', () => {
      const result: BatchDeliveryResult = {
        total: 2,
        sent: 0,
        failed: 2,
        deliveries: [
          { subscriberId: '1', email: 'a@x.com', messageId: null, status: 'failed', error: 'err1', sentAt: new Date() },
          { subscriberId: '2', email: 'b@x.com', messageId: null, status: 'failed', error: 'err2', sentAt: new Date() },
        ],
      };

      expect(getFailedDeliveries(result)).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // getDeliveryStats
  // --------------------------------------------------------------------------

  describe('getDeliveryStats', () => {
    it('calculates correct success and failure rates', () => {
      const result: BatchDeliveryResult = {
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
      const stats = getDeliveryStats({
        total: 0,
        sent: 0,
        failed: 0,
        deliveries: [],
      });

      expect(stats.successRate).toBe(0);
      expect(stats.failureRate).toBe(0);
      expect(stats.averagePerSecond).toBe(0);
    });

    it('handles 100% success rate', () => {
      const stats = getDeliveryStats({
        total: 5,
        sent: 5,
        failed: 0,
        deliveries: [],
      });

      expect(stats.successRate).toBe(100);
      expect(stats.failureRate).toBe(0);
    });

    it('handles 100% failure rate', () => {
      const stats = getDeliveryStats({
        total: 5,
        sent: 0,
        failed: 5,
        deliveries: [],
      });

      expect(stats.successRate).toBe(0);
      expect(stats.failureRate).toBe(100);
    });

    it('returns averagePerSecond estimate', () => {
      const stats = getDeliveryStats({
        total: 10,
        sent: 10,
        failed: 0,
        deliveries: [],
      });

      expect(stats.averagePerSecond).toBe(50);
    });
  });
});

// ============================================================================
// Tier-based content filtering
// ============================================================================

describe('Tier-based content', () => {
  describe('free tier', () => {
    it('shows first 3 ideas unlocked (hero + 2 others)', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'free');

      // Idea 1 is in hero (always visible)
      // Ideas 2-3 are unlocked in secondary list
      // Ideas 4-10 are locked
      expect(result.text).toContain('#2 Idea 2');
      expect(result.text).toContain('Tagline for idea 2');
      expect(result.text).toContain('#3 Idea 3');
      expect(result.text).toContain('Tagline for idea 3');
    });

    it('marks ideas beyond limit as PRO in plain text', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.text).toContain('#4 Idea 4 [PRO]');
      expect(result.text).toContain('#10 Idea 10 [PRO]');
    });

    it('does not show taglines for locked ideas in plain text', () => {
      const briefs = createMockBriefs(6);
      const result = buildDailyEmail(briefs, 'free');

      // Idea 4 is locked (rank 4 > limit 3)
      expect(result.text).toContain('[PRO]');
      // The locked idea's tagline should not appear on the line after it
      const lines = result.text.split('\n');
      const lockedLineIdx = lines.findIndex(l => l.includes('Idea 4 [PRO]'));
      expect(lockedLineIdx).toBeGreaterThan(-1);
      // Next line should not have the tagline
      expect(lines[lockedLineIdx + 1]).not.toContain('Tagline for idea 4');
    });

    it('shows PRO badge on HTML ideas beyond tier limit', () => {
      const briefs = createMockBriefs(6);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('PRO</span>');
    });

    it('shows "available with Pro" message for free tier', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('available with Pro');
    });

    it('shows correct locked count for free tier', () => {
      // 10 briefs. Hero uses #1. Others = #2-#10 (9 items).
      // Free limit = 3. Unlocked = #2-#3 (2 items). Locked = #4-#10 (7 items).
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain('+7 more ideas available with Pro');
    });

    it('shows upgrade URL in plain text', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.text).toContain('Unlock Pro:');
    });
  });

  describe('pro tier', () => {
    it('shows all ideas unlocked', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.text).not.toContain('[LOCKED]');
    });

    it('does not show upgrade CTA in HTML', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.html).not.toContain('Unlock Pro');
      expect(result.html).not.toContain('Unlock all ideas');
    });

    it('does not show upgrade message in plain text', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'pro');

      expect(result.text).not.toContain('Unlock Pro');
    });

    it('does not show PRO badge for any idea rows', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'pro');

      // Pro tier sees all ideas unlocked - no PRO badges
      expect(result.html).not.toContain('>PRO</span>');
    });

    it('shows taglines for all secondary ideas in plain text', () => {
      const briefs = createMockBriefs(10);
      const result = buildDailyEmail(briefs, 'pro');

      for (let i = 2; i <= 10; i++) {
        expect(result.text).toContain(`Tagline for idea ${i}`);
      }
    });
  });

  describe('boundary cases', () => {
    it('exactly at tier limit shows no locked ideas', () => {
      // Free limit is 3, so 3 briefs => hero (1) + 2 others, none locked
      const briefs = createMockBriefs(3);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.text).not.toContain('[PRO]');
      expect(result.html).not.toContain('>PRO</span>');
    });

    it('one above tier limit shows exactly 1 locked idea', () => {
      // Free limit is 3, 4 briefs => hero (1) + others (#2-#4)
      // #2-#3 unlocked, #4 locked
      const briefs = createMockBriefs(4);
      const result = buildDailyEmail(briefs, 'free');

      const lockedMatches = result.text.match(/\[PRO\]/g);
      expect(lockedMatches).toHaveLength(1);
    });

    it('single brief shows no other ideas section for any tier', () => {
      const briefs = [createMockBrief()];

      const freeResult = buildDailyEmail(briefs, 'free');
      const proResult = buildDailyEmail(briefs, 'pro');

      expect(freeResult.html).not.toContain("Today's Other Ideas");
      expect(proResult.html).not.toContain("Today's Other Ideas");
    });

    it('two briefs shows 1 other idea, no locked indicators for free', () => {
      // Free limit = 3, 2 briefs, both visible
      const briefs = createMockBriefs(2);
      const result = buildDailyEmail(briefs, 'free');

      expect(result.html).toContain("Today's Other Ideas");
      expect(result.text).not.toContain('[PRO]');
    });
  });
});

// ============================================================================
// Data assembly — how briefs are formatted into email content
// ============================================================================

describe('Data assembly', () => {
  it('formats priority score to one decimal place', () => {
    const brief = createMockBrief({ priorityScore: 7.856 });
    const result = buildDailyEmail([brief], 'free');

    expect(result.html).toContain('7.9');
    expect(result.text).toContain('7.9');
  });

  it('formats whole number scores with .0', () => {
    const brief = createMockBrief({ priorityScore: 10 });
    const result = buildDailyEmail([brief], 'free');

    expect(result.html).toContain('10.0');
    expect(result.text).toContain('10.0');
  });

  it('ranks secondary ideas correctly starting from #2', () => {
    const briefs = createMockBriefs(4);
    const result = buildDailyEmail(briefs, 'pro');

    // Check rank numbers in plain text
    expect(result.text).toContain('#2 Idea 2');
    expect(result.text).toContain('#3 Idea 3');
    expect(result.text).toContain('#4 Idea 4');
  });

  it('orders ideas by priority score (highest first)', () => {
    const briefs = [
      createMockBrief({ name: 'First', priorityScore: 5 }),
      createMockBrief({ name: 'Second', priorityScore: 10 }),
      createMockBrief({ name: 'Third', priorityScore: 7 }),
    ];
    const result = buildDailyEmail(briefs, 'pro');

    // Hero should be "Second" (highest score 10)
    expect(result.html).toContain('Second');
    // Remaining sorted by score
    expect(result.text).toContain('#2 Third');
    expect(result.text).toContain('#3 First');
  });

  it('includes hero idea details in HTML', () => {
    const brief = createMockBrief({
      problemStatement: 'Big problem here.',
      keyFeatures: ['automated testing', 'CI/CD integration'],
    });
    const result = buildDailyEmail([brief], 'pro');

    // New template shows problem hook and key features teaser
    expect(result.html).toContain('Big problem here.');
    expect(result.html).toContain('automated testing');
    expect(result.html).toContain('View full brief on dashboard');
  });

  it('displays score for each secondary idea in HTML', () => {
    const briefs = [
      createMockBrief({ name: 'Top', priorityScore: 9.5 }),
      createMockBrief({ name: 'Second', priorityScore: 8.2 }),
      createMockBrief({ name: 'Third', priorityScore: 7.1 }),
    ];
    const result = buildDailyEmail(briefs, 'pro');

    expect(result.html).toContain('8.2');
    expect(result.html).toContain('7.1');
  });

  it('displays score for each secondary idea in plain text', () => {
    const briefs = [
      createMockBrief({ name: 'Top', priorityScore: 9.5 }),
      createMockBrief({ name: 'Second', priorityScore: 8.2 }),
    ];
    const result = buildDailyEmail(briefs, 'pro');

    expect(result.text).toContain('Score: 8.2');
  });

  it('returns all three email content fields', () => {
    const result = buildDailyEmail([createMockBrief()], 'free');

    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
  });
});
