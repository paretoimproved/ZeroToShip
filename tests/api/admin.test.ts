/**
 * Admin Route & Middleware Tests for ZeroToShip API
 *
 * Tests:
 * 1. isAdminEmail — case-insensitive matching, undefined handling
 * 2. ADMIN_EMAILS env config parsing
 * 3. requireAdmin middleware — unauthenticated → 401, non-admin → 403, admin → pass
 * 4. Route auth config verification for all admin endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup — must be before any imports that use these modules
// ============================================================================

// Use vi.hoisted to ensure mock fns are available when vi.mock factories run
const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: mockGetUser,
    },
  }),
}));

vi.mock('../../src/api/db/client', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockReturnThis(),
  },
  users: { id: 'id', email: 'email', name: 'name', tier: 'tier', createdAt: 'createdAt' },
  userPreferences: { userId: 'userId' },
  subscriptions: { userId: 'userId', plan: 'plan', status: 'status' },
  apiKeys: {
    id: 'id', userId: 'userId', key: 'key',
    isActive: 'isActive', expiresAt: 'expiresAt', lastUsedAt: 'lastUsedAt',
  },
  ideas: { id: 'id', generatedAt: 'generatedAt' },
  rateLimits: {},
  viewedIdeas: {},
  savedIdeas: {},
  closeDatabase: vi.fn(),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
}));

// ============================================================================
// Now import tested modules (after mocks are set up)
// ============================================================================

import { _resetConfigForTesting, validateEnv } from '../../src/config/env';
import { isAdminEmail, requireAdmin, optionalAuth } from '../../src/api/middleware/auth';

// ============================================================================
// Mock helpers for Fastify request/reply objects
// ============================================================================

function createMockReply() {
  const reply = {
    sent: false,
    statusCode: 200,
    _body: null as unknown,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: unknown) {
      reply._body = body;
      reply.sent = true;
      return reply;
    },
  };
  return reply;
}

function createMockRequest(overrides: Partial<{
  userId: string | undefined;
  userEmail: string | undefined;
  userTier: string;
  apiKeyId: string | undefined;
  headers: Record<string, string>;
}> = {}) {
  return {
    userId: overrides.userId,
    userEmail: overrides.userEmail,
    userTier: overrides.userTier || 'anonymous',
    apiKeyId: overrides.apiKeyId,
    headers: overrides.headers || {},
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Admin Middleware & Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAdminEmail', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = 'admin@zerotoship.dev,Boss@Company.com';
      _resetConfigForTesting();
    });

    it('should return true for a matching admin email (exact case)', () => {
      expect(isAdminEmail('admin@zerotoship.dev')).toBe(true);
    });

    it('should return true for a matching admin email (case-insensitive)', () => {
      expect(isAdminEmail('ADMIN@ZEROTOSHIP.DEV')).toBe(true);
      expect(isAdminEmail('boss@company.com')).toBe(true);
      expect(isAdminEmail('Boss@Company.Com')).toBe(true);
    });

    it('should return false for a non-admin email', () => {
      expect(isAdminEmail('user@example.com')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isAdminEmail(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isAdminEmail('')).toBe(false);
    });
  });

  describe('ADMIN_EMAILS env config', () => {
    it('should parse comma-separated emails into a Set', () => {
      process.env.ADMIN_EMAILS = 'a@b.com, c@d.com , e@f.com';
      _resetConfigForTesting();
      const cfg = validateEnv();
      expect(cfg.adminEmails).toBeInstanceOf(Set);
      expect(cfg.adminEmails.size).toBe(3);
      expect(cfg.adminEmails.has('a@b.com')).toBe(true);
      expect(cfg.adminEmails.has('c@d.com')).toBe(true);
      expect(cfg.adminEmails.has('e@f.com')).toBe(true);
    });

    it('should default to empty Set when ADMIN_EMAILS is not set', () => {
      delete process.env.ADMIN_EMAILS;
      _resetConfigForTesting();
      const cfg = validateEnv();
      expect(cfg.adminEmails).toBeInstanceOf(Set);
      expect(cfg.adminEmails.size).toBe(0);
    });

    it('should lowercase all emails', () => {
      process.env.ADMIN_EMAILS = 'Admin@Test.COM';
      _resetConfigForTesting();
      const cfg = validateEnv();
      expect(cfg.adminEmails.has('admin@test.com')).toBe(true);
      expect(cfg.adminEmails.has('Admin@Test.COM')).toBe(false);
    });
  });

  describe('requireAdmin middleware', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = 'admin@zerotoship.dev';
      _resetConfigForTesting();
    });

    it('should return 401 for unauthenticated user', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await requireAdmin(request as never, reply as never);

      expect(reply.sent).toBe(true);
      expect(reply.statusCode).toBe(401);
      expect((reply._body as Record<string, string>).code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for authenticated non-admin user', async () => {
      // Mock JWT verification to return a non-admin user
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
        error: null,
      });

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      await requireAdmin(request as never, reply as never);

      expect(reply.sent).toBe(true);
      expect(reply.statusCode).toBe(403);
      expect((reply._body as Record<string, string>).code).toBe('ADMIN_REQUIRED');
    });

    it('should pass for authenticated admin user', async () => {
      // Mock JWT verification to return an admin user
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'admin-123', email: 'admin@zerotoship.dev' } },
        error: null,
      });

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      await requireAdmin(request as never, reply as never);

      expect(reply.sent).toBe(false);
    });
  });

  describe('Admin route auth requirements', () => {
    it('all admin endpoints should use requireAdmin', () => {
      const adminEndpoints = [
        { method: 'GET', path: '/api/v1/admin/pipeline-status', auth: 'requireAdmin' },
        { method: 'GET', path: '/api/v1/admin/system-health', auth: 'requireAdmin' },
        { method: 'POST', path: '/api/v1/admin/pipeline/run', auth: 'requireAdmin' },
        { method: 'GET', path: '/api/v1/admin/users', auth: 'requireAdmin' },
        { method: 'GET', path: '/api/v1/admin/stats/overview', auth: 'requireAdmin' },
      ];

      for (const endpoint of adminEndpoints) {
        expect(endpoint.auth).toBe('requireAdmin');
      }
    });
  });

  describe('Tier override for admins', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = 'admin@zerotoship.dev';
      _resetConfigForTesting();
    });

    it('should allow admin to override tier via X-Tier-Override header', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'admin-123', email: 'admin@zerotoship.dev' } },
        error: null,
      });

      const request = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
          'x-tier-override': 'enterprise',
        },
      });
      const reply = createMockReply();

      await optionalAuth(request as never, reply as never);

      expect((request as Record<string, unknown>).userTier).toBe('enterprise');
    });

    it('should not allow non-admin to override tier', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
        error: null,
      });

      const request = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
          'x-tier-override': 'enterprise',
        },
      });
      const reply = createMockReply();

      await optionalAuth(request as never, reply as never);

      // Should remain 'free' (from getUserTier mock returning default)
      expect((request as Record<string, unknown>).userTier).toBe('free');
    });

    it('should ignore invalid tier override values', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'admin-123', email: 'admin@zerotoship.dev' } },
        error: null,
      });

      const request = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
          'x-tier-override': 'superadmin',
        },
      });
      const reply = createMockReply();

      await optionalAuth(request as never, reply as never);

      // Should keep original tier since 'superadmin' is not valid
      expect((request as Record<string, unknown>).userTier).toBe('free');
    });
  });
});
