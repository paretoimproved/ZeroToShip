/**
 * Resend Webhook Tests for ZeroToShip API
 *
 * Tests for Resend webhook event handling and signature verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock hoisted state ─────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => {
  const setMock = vi.fn().mockReturnThis();
  const whereMock = vi.fn().mockResolvedValue([]);
  const updateMock = vi.fn(() => ({ set: setMock }));
  setMock.mockReturnValue({ where: whereMock });

  return {
    update: updateMock,
    set: setMock,
    where: whereMock,
  };
});

const mockVerify = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/db/client', () => ({
  db: {
    update: mockDb.update,
  },
  emailLogs: {
    messageId: 'message_id',
    status: 'status',
    deliveredAt: 'delivered_at',
    openedAt: 'opened_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ column: col, value: val }),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: mockVerify,
  })),
}));

vi.mock('../../src/config/env', () => ({
  config: {
    RESEND_WEBHOOK_SECRET: 'whsec_test_secret',
    PORT: 3001,
    HOST: '0.0.0.0',
    isTest: true,
    isProduction: false,
    logLevel: 'silent',
    corsOrigins: ['http://localhost:3000'],
    databaseUrl: '',
  },
}));

// Mock all other dependencies the server needs
vi.mock('../../src/api/db/client', async () => {
  const setMock = vi.fn().mockReturnThis();
  const whereMock = vi.fn().mockResolvedValue([]);
  const updateMock = vi.fn(() => ({ set: setMock }));
  setMock.mockReturnValue({ where: whereMock });

  return {
    db: {
      update: updateMock,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
            limit: vi.fn().mockResolvedValue([]),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    },
    emailLogs: {
      messageId: 'message_id',
      status: 'status',
      deliveredAt: 'delivered_at',
      openedAt: 'opened_at',
    },
    users: { id: 'id', email: 'email' },
    subscriptions: { userId: 'user_id', status: 'status' },
    pipelineRuns: { startedAt: 'started_at', runId: 'run_id', success: 'success' },
    ideas: { generatedAt: 'generated_at' },
    userPreferences: { userId: 'user_id' },
    closeDatabase: vi.fn(),
    checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { handleResendWebhookEvent, type ResendWebhookEvent } from '../../src/api/services/resendWebhook';

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('Resend Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createEvent(type: string, emailId: string = 're_test123'): ResendWebhookEvent {
    return {
      type,
      data: {
        email_id: emailId,
        from: 'ZeroToShip <briefs@zerotoship.dev>',
        to: ['user@example.com'],
        subject: 'Your Daily Startup Ideas',
        created_at: '2026-02-11T14:00:00Z',
      },
    };
  }

  it('should handle email.delivered event', async () => {
    const event = createEvent('email.delivered');
    await handleResendWebhookEvent(event);

    const { db } = await import('../../src/api/db/client');
    expect(db.update).toHaveBeenCalled();
  });

  it('should handle email.opened event', async () => {
    const event = createEvent('email.opened');
    await handleResendWebhookEvent(event);

    const { db } = await import('../../src/api/db/client');
    expect(db.update).toHaveBeenCalled();
  });

  it('should handle email.bounced event', async () => {
    const event = createEvent('email.bounced');
    await handleResendWebhookEvent(event);

    const { db } = await import('../../src/api/db/client');
    expect(db.update).toHaveBeenCalled();
  });

  it('should handle email.complained event', async () => {
    const event = createEvent('email.complained');
    await handleResendWebhookEvent(event);

    const { db } = await import('../../src/api/db/client');
    expect(db.update).toHaveBeenCalled();
  });

  it('should handle unknown event type without throwing', async () => {
    const event = createEvent('email.clicked');
    await expect(handleResendWebhookEvent(event)).resolves.not.toThrow();
  });

  it('should skip events missing email_id', async () => {
    const event = createEvent('email.delivered', '');
    // @ts-expect-error - testing missing email_id
    event.data.email_id = '';
    await handleResendWebhookEvent(event);

    const { db } = await import('../../src/api/db/client');
    expect(db.update).not.toHaveBeenCalled();
  });
});
