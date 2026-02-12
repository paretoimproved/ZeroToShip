/**
 * Tests for the Onboarding Email Drip Service
 *
 * Covers: idempotent sending, drip window queries, Resend API mocking,
 * user lookup, and processOnboardingDrip orchestration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.mock calls are hoisted, so factories must not reference
// variables declared outside the factory. We use vi.hoisted() to ensure
// the mock objects are available at hoist time.
// ---------------------------------------------------------------------------

const {
  selectReturnValues,
  dbMock,
  resetSelectCallCount,
} = vi.hoisted(() => {
  /** Return values for successive db.select() calls */
  const selectReturnValues: unknown[][] = [];
  let selectCallCount = 0;

  /**
   * Creates a chainable mock that also works as a thenable.
   * Drizzle queries are awaitable without calling .execute() --
   * they implement the thenable protocol. Our mock mirrors this
   * by attaching a `.then()` method that resolves to the return data.
   */
  function createSelectChain(returnValue: unknown[] = []) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;

    chain.from = vi.fn(self);
    chain.where = vi.fn(self);
    chain.leftJoin = vi.fn(self);
    chain.limit = vi.fn().mockResolvedValue(returnValue);
    // thenable: when the chain is awaited without .limit(), resolve to the data
    chain.then = (
      resolve?: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(returnValue).then(resolve, reject);

    return chain;
  }

  function createInsertChain() {
    const chain: Record<string, unknown> = {};
    chain.values = vi.fn().mockResolvedValue(undefined);
    return chain;
  }

  const dbMock = {
    select: vi.fn(() => {
      const idx = selectCallCount++;
      const returnValue = selectReturnValues[idx] || [];
      return createSelectChain(returnValue);
    }),
    insert: vi.fn(() => createInsertChain()),
  };

  function resetSelectCallCount() {
    selectCallCount = 0;
    selectReturnValues.length = 0;
  }

  return { selectReturnValues, dbMock, resetSelectCallCount };
});

vi.mock('../../src/api/db/client', () => ({
  db: dbMock,
  users: {
    id: 'users.id',
    email: 'users.email',
    name: 'users.name',
    createdAt: 'users.created_at',
  },
  subscriptions: {
    userId: 'subscriptions.user_id',
    plan: 'subscriptions.plan',
    status: 'subscriptions.status',
  },
  onboardingEmails: {
    id: 'onboarding_emails.id',
    userId: 'onboarding_emails.user_id',
    emailType: 'onboarding_emails.email_type',
    sentAt: 'onboarding_emails.sent_at',
  },
}));

vi.mock('../../src/config/env', () => ({
  config: {
    RESEND_API_KEY: 'test_resend_key_123',
    logLevel: 'error',
    isProduction: false,
    isTest: true,
  },
}));

vi.mock('../../src/lib/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Import module under test (after mocks are set up)
// ---------------------------------------------------------------------------

import {
  sendOnboardingEmail,
  processOnboardingDrip,
} from '../../src/delivery/onboarding';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResendSuccess(messageId = 'msg_onboarding_123') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: messageId }),
  });
}

function mockResendError(status = 401, message = 'Invalid API key') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({
      statusCode: status,
      message,
      name: 'ApiError',
    }),
  });
}

const testUser = {
  id: 'user_001',
  email: 'test@example.com',
  name: 'Test User',
  tier: 'free',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Onboarding Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    resetSelectCallCount();
  });

  // ==========================================================================
  // sendOnboardingEmail
  // ==========================================================================

  describe('sendOnboardingEmail', () => {
    it('sends email via Resend and records in database', async () => {
      // First select: check if already sent -> empty (not sent)
      // Second select: fetch user data -> return user
      selectReturnValues.push([], [testUser]);

      mockResendSuccess('msg_welcome_001');

      const result = await sendOnboardingEmail('user_001', 'welcome');

      expect(result.sent).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.messageId).toBe('msg_welcome_001');
      expect(result.error).toBeUndefined();

      // Verify Resend was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.resend.com/emails');

      const body = JSON.parse(fetchCall[1].body);
      expect(body.to).toEqual(['test@example.com']);
      expect(body.subject).toBe(
        'Welcome to ZeroToShip - Your first ideas are inside'
      );
      expect(body.from).toBe('ZeroToShip <briefs@zerotoship.dev>');
      expect(body.reply_to).toBe('hello@zerotoship.dev');

      // Verify DB insert was called to record the send
      expect(dbMock.insert).toHaveBeenCalled();
    });

    it('skips if email was already sent (idempotent)', async () => {
      // First select: check if already sent -> found a record
      selectReturnValues.push([{ id: 'existing_record' }]);

      const result = await sendOnboardingEmail('user_001', 'welcome');

      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(true);

      // Should not call Resend
      expect(mockFetch).not.toHaveBeenCalled();

      // Should not record a new send
      expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it('returns error when user is not found', async () => {
      // First select: check if already sent -> empty
      // Second select: fetch user data -> empty
      selectReturnValues.push([], []);

      const result = await sendOnboardingEmail('nonexistent_user', 'welcome');

      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.error).toContain('User not found');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles Resend API errors gracefully', async () => {
      selectReturnValues.push([], [testUser]);

      mockResendError(500, 'Internal server error');

      const result = await sendOnboardingEmail('user_001', 'day1');

      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.error).toContain('Resend API error (500)');

      // Should not record in DB since send failed
      expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it('handles network errors gracefully', async () => {
      selectReturnValues.push([], [testUser]);

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await sendOnboardingEmail('user_001', 'day3');

      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('sends correct subject for each email type', async () => {
      const expectedSubjects: Record<string, string> = {
        welcome: 'Welcome to ZeroToShip - Your first ideas are inside',
        day1: 'Did any ideas spark your interest?',
        day3: "What you're missing in the full briefs",
        day7: 'Your first week with ZeroToShip',
      };

      for (const [emailType, expectedSubject] of Object.entries(
        expectedSubjects
      )) {
        // Reset for each iteration
        resetSelectCallCount();
        mockFetch.mockReset();

        selectReturnValues.push([], [testUser]);
        mockResendSuccess();

        await sendOnboardingEmail(
          'user_001',
          emailType as 'welcome' | 'day1' | 'day3' | 'day7'
        );

        const fetchCall = mockFetch.mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.subject).toBe(expectedSubject);
      }
    });

    it('personalizes email content with user name', async () => {
      selectReturnValues.push([], [{ ...testUser, name: 'Alice' }]);

      mockResendSuccess();

      await sendOnboardingEmail('user_001', 'welcome');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // HTML should contain the user's name
      expect(body.html).toContain('Alice');
      expect(body.text).toContain('Alice');
    });

    it('uses fallback name when user has no name', async () => {
      selectReturnValues.push([], [{ ...testUser, name: null }]);

      mockResendSuccess();

      await sendOnboardingEmail('user_001', 'welcome');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // Should use "there" as fallback
      expect(body.html).toContain('Hey there');
      expect(body.text).toContain('Hey there');
    });
  });

  // ==========================================================================
  // processOnboardingDrip
  // ==========================================================================

  describe('processOnboardingDrip', () => {
    it('returns empty result when no eligible users exist', async () => {
      // Four drip windows, each returns no eligible users
      selectReturnValues.push([], [], [], []);

      const result = await processOnboardingDrip();

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    it('processes eligible users from drip windows', async () => {
      // Window 1 (welcome): 1 user eligible
      // sendOnboardingEmail for user_welcome: check already sent, fetch user
      // Window 2 (day1): 0 users
      // Window 3 (day3): 1 user eligible
      // sendOnboardingEmail for user_day3: check already sent, fetch user
      // Window 4 (day7): 0 users
      selectReturnValues.push(
        [{ id: 'user_welcome' }], // welcome window query
        [], // check if already sent -> not sent
        [
          {
            id: 'user_welcome',
            email: 'welcome@test.com',
            name: 'Welcome User',
            tier: 'free',
          },
        ], // fetch user
        [], // day1 window query
        [{ id: 'user_day3' }], // day3 window query
        [], // check if already sent -> not sent
        [
          {
            id: 'user_day3',
            email: 'day3@test.com',
            name: 'Day3 User',
            tier: 'pro',
          },
        ], // fetch user
        [] // day7 window query
      );

      // Two Resend calls
      mockResendSuccess('msg_welcome');
      mockResendSuccess('msg_day3');

      const result = await processOnboardingDrip();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toHaveLength(2);

      expect(result.details[0].emailType).toBe('welcome');
      expect(result.details[0].sent).toBe(true);
      expect(result.details[1].emailType).toBe('day3');
      expect(result.details[1].sent).toBe(true);
    });

    it('handles mixed success and failure in a single run', async () => {
      // Window 1 (welcome): 2 users (drip query now returns full user data)
      selectReturnValues.push(
        [
          { id: 'user_a', email: 'a@test.com', name: 'User A', tier: 'free' },
          { id: 'user_b', email: 'b@test.com', name: 'User B', tier: 'free' },
        ], // welcome window query (includes user data)
        [], // day1 window query
        [], // day3 window query
        [] // day7 window query
      );

      // First succeeds, second fails
      mockResendSuccess('msg_a');
      mockResendError(429, 'Rate limited');

      const result = await processOnboardingDrip();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.details).toHaveLength(2);

      const successDetail = result.details.find((d) => d.userId === 'user_a');
      const failDetail = result.details.find((d) => d.userId === 'user_b');

      expect(successDetail?.sent).toBe(true);
      expect(failDetail?.sent).toBe(false);
      expect(failDetail?.error).toContain('Resend API error');
    });

    it('skips users filtered by LEFT JOIN (already received)', async () => {
      // The LEFT JOIN + isNull filter in the drip query already excludes
      // users who received the email, so an empty result means no sends.
      selectReturnValues.push(
        [], // welcome window query (no eligible users after LEFT JOIN filter)
        [], // day1 window query
        [], // day3 window query
        [] // day7 window query
      );

      const result = await processOnboardingDrip();

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);

      // Resend should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
