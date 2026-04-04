/**
 * Integration tests for the Deliver Phase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDeliverPhase } from '../../../src/scheduler/phases/deliver';
import type { PipelineConfig } from '../../../src/scheduler/types';
import { makeGenerationBrief } from '../../fixtures';

// Mock email delivery
vi.mock('../../../src/delivery/email', () => ({
  sendDailyBriefsBatch: vi.fn(),
}));

// Mock database client (used by getActiveSubscribers)
vi.mock('../../../src/api/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
  users: {},
  subscriptions: {},
  userPreferences: {},
}));

// Mock drizzle-orm (used for eq operator in queries)
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockReturnValue('mock-eq'),
}));

function makeConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    hoursBack: 24,
    scrapers: { reddit: true, hn: true, twitter: true, github: true },
    clusteringThreshold: 0.85,
    minFrequencyForGap: 2,
    maxBriefs: 10,
    minPriorityScore: 0.5,
    dryRun: false,
    verbose: false,
    ...overrides,
  };
}

async function mockSubscribers(subscribers: Array<{ id: string; email: string; tier: string; emailFrequency?: string }>) {
  const { db } = await import('../../../src/api/db/client');
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            subscribers.map((s) => ({
              id: s.id,
              email: s.email,
              tier: s.tier,
              emailFrequency: s.emailFrequency ?? 'daily',
            }))
          ),
        }),
      }),
    }),
  } as ReturnType<typeof db.select>);
}

describe('Deliver Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path', () => {
    it('should send emails to active subscribers', async () => {
      const { sendDailyBriefsBatch } = await import('../../../src/delivery/email');

      await mockSubscribers([
        { id: 'u1', email: 'alice@example.com', tier: 'pro' },
        { id: 'u2', email: 'bob@example.com', tier: 'free' },
      ]);

      vi.mocked(sendDailyBriefsBatch).mockResolvedValue({
        total: 2,
        sent: 2,
        failed: 0,
        deliveries: [],
      });

      const briefs = [makeGenerationBrief()];
      const result = await runDeliverPhase('test-run-1', makeConfig(), briefs);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('deliver');
      expect(result.data).not.toBeNull();
      expect(result.data!.subscriberCount).toBe(2);
      expect(result.data!.sent).toBe(2);
      expect(result.data!.failed).toBe(0);
      expect(result.data!.dryRun).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should report partial success when some emails fail', async () => {
      const { sendDailyBriefsBatch } = await import('../../../src/delivery/email');

      await mockSubscribers([
        { id: 'u1', email: 'alice@example.com', tier: 'pro' },
        { id: 'u2', email: 'bob@example.com', tier: 'free' },
      ]);

      vi.mocked(sendDailyBriefsBatch).mockResolvedValue({
        total: 2,
        sent: 1,
        failed: 1,
        deliveries: [],
      });

      const result = await runDeliverPhase('test-run-partial', makeConfig(), [makeGenerationBrief()]);

      // success = (failed === 0 || sent > 0) => true
      expect(result.success).toBe(true);
      expect(result.data!.sent).toBe(1);
      expect(result.data!.failed).toBe(1);
    });
  });

  describe('dry run mode', () => {
    it('should skip email sending in dry run mode', async () => {
      const { sendDailyBriefsBatch } = await import('../../../src/delivery/email');

      await mockSubscribers([
        { id: 'u1', email: 'alice@example.com', tier: 'pro' },
      ]);

      const config = makeConfig({ dryRun: true });
      const result = await runDeliverPhase('test-run-dry', config, [makeGenerationBrief()]);

      expect(result.success).toBe(true);
      expect(result.data!.dryRun).toBe(true);
      expect(result.data!.sent).toBe(0);
      expect(result.data!.subscriberCount).toBe(1);
      expect(sendDailyBriefsBatch).not.toHaveBeenCalled();
    });
  });

  describe('no subscribers', () => {
    it('should return success with zero counts when no subscribers exist', async () => {
      const { sendDailyBriefsBatch } = await import('../../../src/delivery/email');

      // Explicitly mock empty subscribers
      await mockSubscribers([]);

      const result = await runDeliverPhase('test-run-no-subs', makeConfig(), [makeGenerationBrief()]);

      expect(result.success).toBe(true);
      expect(result.data!.subscriberCount).toBe(0);
      expect(result.data!.sent).toBe(0);
      expect(result.data!.failed).toBe(0);
      expect(result.data!.dryRun).toBe(false);
      expect(sendDailyBriefsBatch).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return failure when sendDailyBriefsBatch throws', async () => {
      const { sendDailyBriefsBatch } = await import('../../../src/delivery/email');

      await mockSubscribers([
        { id: 'u1', email: 'alice@example.com', tier: 'pro' },
      ]);

      vi.mocked(sendDailyBriefsBatch).mockRejectedValue(new Error('Resend API down'));

      const result = await runDeliverPhase('test-run-err', makeConfig(), [makeGenerationBrief()]);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('Resend API down');
      expect(result.phase).toBe('deliver');
    });

    it('should return failure when database query throws', async () => {
      const { db } = await import('../../../src/api/db/client');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockRejectedValue(new Error('DB connection failed')),
            }),
          }),
        }),
      } as ReturnType<typeof db.select>);

      const result = await runDeliverPhase('test-run-db-err', makeConfig(), [makeGenerationBrief()]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB connection failed');
    });
  });

  describe('edge cases', () => {
    it('should filter out subscribers with emailFrequency=never', async () => {
      const { sendDailyBriefsBatch } = await import('../../../src/delivery/email');

      await mockSubscribers([
        { id: 'u1', email: 'alice@example.com', tier: 'pro', emailFrequency: 'daily' },
        { id: 'u2', email: 'bob@example.com', tier: 'free', emailFrequency: 'never' },
      ]);

      vi.mocked(sendDailyBriefsBatch).mockResolvedValue({
        total: 1,
        sent: 1,
        failed: 0,
        deliveries: [],
      });

      const result = await runDeliverPhase('test-run-filter', makeConfig(), [makeGenerationBrief()]);

      expect(result.success).toBe(true);
      expect(result.data!.subscriberCount).toBe(1);
    });

    it('should handle all sends failing', async () => {
      const { sendDailyBriefsBatch } = await import('../../../src/delivery/email');

      await mockSubscribers([
        { id: 'u1', email: 'alice@example.com', tier: 'pro' },
      ]);

      vi.mocked(sendDailyBriefsBatch).mockResolvedValue({
        total: 1,
        sent: 0,
        failed: 1,
        deliveries: [],
      });

      const result = await runDeliverPhase('test-run-all-fail', makeConfig(), [makeGenerationBrief()]);

      // success = (failed === 0 || sent > 0) => false
      expect(result.success).toBe(false);
      expect(result.data!.sent).toBe(0);
      expect(result.data!.failed).toBe(1);
    });
  });
});
