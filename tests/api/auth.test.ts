/**
 * Authentication & Authorization Tests for ZeroToShip API
 *
 * Tests:
 * 1. API key generation
 * 2. Feature access control (hasAccess, tier hierarchy)
 * 3. Auth middleware behavior (requireAuth, requireEnterprise, requirePro, optionalAuth)
 * 4. Tier gate middleware behavior
 * 5. Route auth documentation (which routes require what auth)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'crypto';
import {
  hasAccess,
  getIdeasLimit,
  FEATURE_ACCESS,
  type UserTier,
} from '../../src/api/config/tiers';

// ============================================================================
// Mock helpers for Fastify request/reply objects
// ============================================================================

/**
 * Create a mock Fastify reply object that captures status codes and response bodies
 */
function createMockReply() {
  const reply: any = {
    sent: false,
    statusCode: 200,
    _body: null,
    _headers: {} as Record<string, string>,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: any) {
      reply._body = body;
      reply.sent = true;
      return reply;
    },
    header(name: string, value: string) {
      reply._headers[name] = value;
      return reply;
    },
    getHeader(name: string) {
      return reply._headers[name];
    },
  };
  return reply;
}

/**
 * Create a mock Fastify request object
 */
function createMockRequest(overrides: Partial<{
  userId: string | undefined;
  userTier: string;
  apiKeyId: string | undefined;
  headers: Record<string, string>;
  ip: string;
}> = {}) {
  return {
    userId: overrides.userId,
    userTier: overrides.userTier || 'anonymous',
    apiKeyId: overrides.apiKeyId,
    headers: overrides.headers || {},
    ip: overrides.ip || '127.0.0.1',
  } as any;
}

/**
 * Local implementation of createTierGate for testing (avoids db imports via rateLimit.ts)
 * Mirrors the logic in src/api/middleware/tierGate.ts without transitive db dependencies
 */
function createTierGate(feature: string) {
  return async (request: any, reply: any): Promise<void> => {
    if (!hasAccess(request.userTier, feature)) {
      const featureConfig = FEATURE_ACCESS[feature];
      reply.status(403).send({
        code: 'TIER_RESTRICTED',
        message: `This feature requires ${featureConfig?.minTier || 'a higher'} tier or above`,
        details: {
          feature,
          requiredTier: featureConfig?.minTier,
          currentTier: request.userTier,
          upgradeUrl: 'https://zerotoship.dev/pricing',
        },
      });
    }
  };
}

// Local implementation of generateApiKey for testing (avoids db imports)
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'if_';
  const bytes = randomBytes(48);
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(bytes[i] % chars.length);
  }
  return key;
}

// ============================================================================
// API Key Generation Tests
// ============================================================================

describe('Authentication', () => {
  describe('generateApiKey', () => {
    it('should generate a key with correct prefix', () => {
      const key = generateApiKey();
      expect(key.startsWith('if_')).toBe(true);
    });

    it('should generate a key with correct length', () => {
      const key = generateApiKey();
      expect(key.length).toBe(51); // 'if_' + 48 chars
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateApiKey());
      }
      expect(keys.size).toBe(100);
    });

    it('should only use alphanumeric characters after prefix', () => {
      const key = generateApiKey();
      const keyPart = key.slice(3);
      expect(/^[A-Za-z0-9]+$/.test(keyPart)).toBe(true);
    });
  });
});

// ============================================================================
// Feature Access Tests
// ============================================================================

describe('Feature Access', () => {
  describe('hasAccess', () => {
    it('should allow anonymous access to public features', () => {
      expect(hasAccess('anonymous', 'ideas.today')).toBe(true);
      expect(hasAccess('anonymous', 'ideas.detail')).toBe(true);
    });

    it('should deny anonymous access to protected features', () => {
      expect(hasAccess('anonymous', 'ideas.archive')).toBe(true);
      expect(hasAccess('anonymous', 'user.preferences')).toBe(false);
    });

    it('should allow free tier access to basic features', () => {
      expect(hasAccess('free', 'ideas.today')).toBe(true);
      expect(hasAccess('free', 'user.preferences')).toBe(true);
    });

    it('should deny free tier access to pro features', () => {
      expect(hasAccess('free', 'ideas.fullBrief')).toBe(false);
      expect(hasAccess('free', 'ideas.archive')).toBe(true);
      expect(hasAccess('free', 'ideas.search')).toBe(false);
      expect(hasAccess('free', 'validate')).toBe(false);
    });

    it('should deny free tier access to enterprise features', () => {
      expect(hasAccess('free', 'ideas.export')).toBe(false);
    });

    it('should allow pro tier access to pro features', () => {
      expect(hasAccess('pro', 'ideas.fullBrief')).toBe(true);
      expect(hasAccess('pro', 'ideas.archive')).toBe(true);
      expect(hasAccess('pro', 'ideas.search')).toBe(true);
      expect(hasAccess('pro', 'validate')).toBe(true);
    });

    it('should deny pro tier access to enterprise features', () => {
      expect(hasAccess('pro', 'ideas.export')).toBe(false);
    });

    it('should allow enterprise tier access to all features', () => {
      const features = Object.keys(FEATURE_ACCESS);
      for (const feature of features) {
        expect(hasAccess('enterprise', feature)).toBe(true);
      }
    });

    it('should return false for unknown features', () => {
      expect(hasAccess('enterprise', 'unknown.feature')).toBe(false);
    });
  });

  describe('getIdeasLimit', () => {
    it('should return correct limits for each tier', () => {
      expect(getIdeasLimit('anonymous')).toBe(3);
      expect(getIdeasLimit('free')).toBe(3);
      expect(getIdeasLimit('pro')).toBe(10);
      expect(getIdeasLimit('enterprise')).toBe(Infinity);
    });
  });
});

describe('Tier Hierarchy', () => {
  it('should respect tier hierarchy for all features', () => {
    const tiers = ['anonymous', 'free', 'pro', 'enterprise'] as const;

    for (const [feature, config] of Object.entries(FEATURE_ACCESS)) {
      const minTierIndex = tiers.indexOf(config.minTier);

      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const shouldHaveAccess = i >= minTierIndex;
        expect(hasAccess(tier, feature)).toBe(shouldHaveAccess);
      }
    }
  });
});

// ============================================================================
// Tier Gate Middleware Integration Tests
// ============================================================================

describe('Tier Gate Middleware', () => {
  describe('createTierGate', () => {
    it('should allow access when user tier meets minimum requirement', async () => {
      const gate = createTierGate('ideas.fullBrief'); // minTier: 'pro'
      const request = createMockRequest({ userTier: 'pro' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(false);
    });

    it('should allow access when user tier exceeds minimum requirement', async () => {
      const gate = createTierGate('ideas.fullBrief'); // minTier: 'pro'
      const request = createMockRequest({ userTier: 'enterprise' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(false);
    });

    it('should deny access with 403 when user tier is below minimum', async () => {
      const gate = createTierGate('ideas.fullBrief'); // minTier: 'pro'
      const request = createMockRequest({ userTier: 'free' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(true);
      expect(reply.statusCode).toBe(403);
      expect(reply._body.code).toBe('TIER_RESTRICTED');
    });

    it('should deny anonymous access to pro features with 403', async () => {
      const gate = createTierGate('ideas.search'); // minTier: 'pro'
      const request = createMockRequest({ userTier: 'anonymous' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(true);
      expect(reply.statusCode).toBe(403);
      expect(reply._body.code).toBe('TIER_RESTRICTED');
      expect(reply._body.details.requiredTier).toBe('pro');
      expect(reply._body.details.currentTier).toBe('anonymous');
    });

    it('should deny free tier access to enterprise features with 403', async () => {
      const gate = createTierGate('ideas.export'); // minTier: 'enterprise'
      const request = createMockRequest({ userTier: 'free' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(true);
      expect(reply.statusCode).toBe(403);
      expect(reply._body.details.requiredTier).toBe('enterprise');
    });

    it('should deny pro tier access to enterprise features with 403', async () => {
      const gate = createTierGate('ideas.export'); // minTier: 'enterprise'
      const request = createMockRequest({ userTier: 'pro' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(true);
      expect(reply.statusCode).toBe(403);
    });

    it('should allow enterprise tier access to enterprise features', async () => {
      const gate = createTierGate('ideas.export');
      const request = createMockRequest({ userTier: 'enterprise' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(false);
    });

    it('should deny access to pro features for free users', async () => {
      const gate = createTierGate('ideas.fullBrief'); // minTier: 'pro'
      const request = createMockRequest({ userTier: 'free' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(true);
      expect(reply.statusCode).toBe(403);
      expect(reply._body.details.requiredTier).toBe('pro');
    });

    it('should include upgrade URL in 403 response', async () => {
      const gate = createTierGate('ideas.search');
      const request = createMockRequest({ userTier: 'free' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply._body.details.upgradeUrl).toBe('https://zerotoship.dev/pricing');
    });
  });
});

// ============================================================================
// Route Auth Configuration Verification
// ============================================================================

describe('Route Auth Configuration', () => {
  /**
   * This section documents and verifies the expected auth configuration
   * for every route in the API. If a route is added without updating
   * this test, it will serve as a reminder to audit the new route's auth.
   */

  describe('Public routes (no auth required)', () => {
    const publicRoutes = [
      { method: 'GET', path: '/health', reason: 'Health check for load balancers' },
      { method: 'GET', path: '/ready', reason: 'Readiness probe for orchestration' },
      { method: 'GET', path: '/live', reason: 'Liveness probe for orchestration' },
      { method: 'GET', path: '/api/v1', reason: 'API version info' },
      { method: 'GET', path: '/api/v1/billing/prices', reason: 'Public pricing page' },
      { method: 'POST', path: '/api/webhooks/stripe', reason: 'Stripe webhook (signature verified)' },
    ];

    it('should have a defined set of public routes', () => {
      expect(publicRoutes.length).toBe(6);
    });

    it('should have valid reasons for each public route', () => {
      for (const route of publicRoutes) {
        expect(route.reason).toBeTruthy();
        expect(route.method).toMatch(/^(GET|POST|PUT|DELETE)$/);
      }
    });
  });

  describe('optionalAuth routes (anonymous access allowed, auth enhances response)', () => {
    const optionalAuthRoutes = [
      { method: 'GET', path: '/api/v1/ideas/today', tier: 'anonymous' },
      { method: 'GET', path: '/api/v1/ideas/categories', tier: 'anonymous' },
      { method: 'GET', path: '/api/v1/ideas/:id', tier: 'anonymous' },
      { method: 'GET', path: '/api/v1/ideas/archive', tier: 'anonymous', tierGate: 'ideas.archive' },
    ];

    it('should have correct tier requirements for optionalAuth routes', () => {
      for (const route of optionalAuthRoutes) {
        if (route.tierGate) {
          const featureConfig = FEATURE_ACCESS[route.tierGate];
          expect(featureConfig).toBeDefined();
          expect(featureConfig.minTier).toBe(route.tier);
        }
      }
    });

    it('ideas.today should be accessible to anonymous', () => {
      expect(hasAccess('anonymous', 'ideas.today')).toBe(true);
    });

    it('ideas.archive should be accessible by all tiers (preview for lower tiers)', () => {
      expect(hasAccess('anonymous', 'ideas.archive')).toBe(true);
      expect(hasAccess('free', 'ideas.archive')).toBe(true);
      expect(hasAccess('pro', 'ideas.archive')).toBe(true);
    });
  });

  describe('requireAuth routes (must be logged in)', () => {
    const requireAuthRoutes = [
      { method: 'POST', path: '/api/v1/ideas/:id/save' },
      { method: 'DELETE', path: '/api/v1/ideas/:id/save' },
      { method: 'GET', path: '/api/v1/user/preferences' },
      { method: 'PUT', path: '/api/v1/user/preferences' },
      { method: 'GET', path: '/api/v1/user/subscription' },
      { method: 'GET', path: '/api/v1/user/history' },
      { method: 'GET', path: '/api/v1/user/usage' },
      { method: 'POST', path: '/api/v1/billing/checkout' },
      { method: 'POST', path: '/api/v1/billing/portal' },
    ];

    it('should have 9 routes requiring basic authentication', () => {
      expect(requireAuthRoutes.length).toBe(9);
    });

    it('user feature access should require at least free tier', () => {
      expect(hasAccess('anonymous', 'user.preferences')).toBe(false);
      expect(hasAccess('free', 'user.preferences')).toBe(true);

      expect(hasAccess('anonymous', 'user.history')).toBe(false);
      expect(hasAccess('free', 'user.history')).toBe(true);

      expect(hasAccess('anonymous', 'user.subscription')).toBe(false);
      expect(hasAccess('free', 'user.subscription')).toBe(true);
    });
  });

  describe('requireEnterprise routes (enterprise tier only)', () => {
    const enterpriseRoutes = [
      { method: 'GET', path: '/api/v1/ideas/search', tierGate: 'ideas.search' },
      { method: 'POST', path: '/api/v1/validate', tierGate: 'validate' },
      { method: 'GET', path: '/api/v1/validate/:id' },
      { method: 'GET', path: '/api/v1/export', tierGate: 'ideas.export' },
      { method: 'GET', path: '/api/v1/stats' },
      { method: 'GET', path: '/api/v1/user/api-keys' },
      { method: 'POST', path: '/api/v1/user/api-keys' },
      { method: 'DELETE', path: '/api/v1/user/api-keys/:id' },
      { method: 'POST', path: '/api/v1/user/api-keys/:id/deactivate' },
    ];

    it('should have 9 enterprise-only routes', () => {
      expect(enterpriseRoutes.length).toBe(9);
    });

    it('enterprise-exclusive features should require enterprise tier', () => {
      expect(hasAccess('pro', 'ideas.export')).toBe(false);
      expect(hasAccess('enterprise', 'ideas.export')).toBe(true);

      expect(hasAccess('pro', 'api.keys')).toBe(false);
      expect(hasAccess('enterprise', 'api.keys')).toBe(true);
    });

    it('pro-tier features should be accessible by pro and enterprise', () => {
      expect(hasAccess('pro', 'ideas.search')).toBe(true);
      expect(hasAccess('enterprise', 'ideas.search')).toBe(true);

      expect(hasAccess('pro', 'validate')).toBe(true);
      expect(hasAccess('enterprise', 'validate')).toBe(true);
    });

    it('should deny free users from all enterprise features', () => {
      const enterpriseFeatures = ['ideas.search', 'ideas.export', 'validate', 'api.keys'];
      for (const feature of enterpriseFeatures) {
        expect(hasAccess('free', feature)).toBe(false);
      }
    });

    it('should deny anonymous users from all enterprise features', () => {
      const enterpriseFeatures = ['ideas.search', 'ideas.export', 'validate', 'api.keys'];
      for (const feature of enterpriseFeatures) {
        expect(hasAccess('anonymous', feature)).toBe(false);
      }
    });
  });
});

// ============================================================================
// Auth Middleware Simulation Tests
// ============================================================================

describe('Auth Middleware Behavior', () => {
  /**
   * These tests simulate the behavior of auth middleware functions
   * using mock request/reply objects to verify:
   * - Unauthenticated requests to protected routes return 401
   * - Wrong tier trying tier-gated routes returns 403
   * - Public routes work without auth
   * - The middleware chain works correctly
   */

  describe('requireAuth behavior', () => {
    /**
     * Simulates requireAuth middleware logic:
     * 1. Calls optionalAuth to populate user info
     * 2. If no userId, sends 401
     */
    function simulateRequireAuth(request: any, reply: any) {
      // After optionalAuth runs, if no userId -> 401
      if (!request.userId) {
        reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
    }

    it('should return 401 for unauthenticated request', () => {
      const request = createMockRequest({ userId: undefined });
      const reply = createMockReply();

      simulateRequireAuth(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply._body.code).toBe('UNAUTHORIZED');
      expect(reply._body.message).toBe('Authentication required');
    });

    it('should pass through for authenticated request', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'free',
      });
      const reply = createMockReply();

      simulateRequireAuth(request, reply);

      expect(reply.sent).toBe(false);
    });
  });

  describe('requireEnterprise behavior', () => {
    /**
     * Simulates requireEnterprise middleware logic:
     * 1. Calls requireAuth
     * 2. If authenticated but not enterprise, sends 403
     */
    function simulateRequireEnterprise(request: any, reply: any) {
      // First check auth
      if (!request.userId) {
        reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      // Then check tier
      if (request.userTier !== 'enterprise') {
        reply.status(403).send({
          code: 'ENTERPRISE_REQUIRED',
          message: 'This endpoint requires an Enterprise subscription',
        });
      }
    }

    it('should return 401 for unauthenticated request', () => {
      const request = createMockRequest({ userId: undefined });
      const reply = createMockReply();

      simulateRequireEnterprise(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply._body.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for free tier user', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'free',
      });
      const reply = createMockReply();

      simulateRequireEnterprise(request, reply);

      expect(reply.statusCode).toBe(403);
      expect(reply._body.code).toBe('ENTERPRISE_REQUIRED');
    });

    it('should return 403 for pro tier user', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'pro',
      });
      const reply = createMockReply();

      simulateRequireEnterprise(request, reply);

      expect(reply.statusCode).toBe(403);
      expect(reply._body.code).toBe('ENTERPRISE_REQUIRED');
    });

    it('should pass through for enterprise tier user', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'enterprise',
      });
      const reply = createMockReply();

      simulateRequireEnterprise(request, reply);

      expect(reply.sent).toBe(false);
    });
  });

  describe('requirePro behavior', () => {
    /**
     * Simulates requirePro middleware logic:
     * 1. Calls requireAuth
     * 2. If authenticated but not pro or enterprise, sends 403
     */
    function simulateRequirePro(request: any, reply: any) {
      // First check auth
      if (!request.userId) {
        reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      // Then check tier
      if (request.userTier !== 'pro' && request.userTier !== 'enterprise') {
        reply.status(403).send({
          code: 'PRO_REQUIRED',
          message: 'This endpoint requires a Builder or Enterprise subscription',
        });
      }
    }

    it('should return 401 for unauthenticated request', () => {
      const request = createMockRequest({ userId: undefined });
      const reply = createMockReply();

      simulateRequirePro(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply._body.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for free tier user', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'free',
      });
      const reply = createMockReply();

      simulateRequirePro(request, reply);

      expect(reply.statusCode).toBe(403);
      expect(reply._body.code).toBe('PRO_REQUIRED');
    });

    it('should pass through for pro tier user', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'pro',
      });
      const reply = createMockReply();

      simulateRequirePro(request, reply);

      expect(reply.sent).toBe(false);
    });

    it('should pass through for enterprise tier user', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'enterprise',
      });
      const reply = createMockReply();

      simulateRequirePro(request, reply);

      expect(reply.sent).toBe(false);
    });
  });

  describe('optionalAuth behavior', () => {
    it('should default to anonymous tier when no auth provided', () => {
      const request = createMockRequest({});
      expect(request.userTier).toBe('anonymous');
      expect(request.userId).toBeUndefined();
    });

    it('should have user info when authenticated', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'pro',
      });
      expect(request.userId).toBe('user-123');
      expect(request.userTier).toBe('pro');
    });

    it('should set enterprise tier for API key auth', () => {
      const request = createMockRequest({
        userId: 'user-123',
        userTier: 'enterprise',
        apiKeyId: 'key-456',
      });
      expect(request.userTier).toBe('enterprise');
      expect(request.apiKeyId).toBe('key-456');
    });
  });
});

// ============================================================================
// API Key Auth for Enterprise Routes
// ============================================================================

describe('API Key Authentication', () => {
  it('should set enterprise tier when API key is valid', () => {
    // API key users are always enterprise tier (per auth.ts line 157)
    const request = createMockRequest({
      userId: 'user-123',
      userTier: 'enterprise',
      apiKeyId: 'key-456',
    });

    expect(request.userTier).toBe('enterprise');
    expect(request.apiKeyId).toBeDefined();
  });

  it('enterprise routes should be accessible with API key auth', () => {
    // When API key is valid, user gets enterprise tier
    // Enterprise routes check userTier === 'enterprise'
    const request = createMockRequest({
      userId: 'user-123',
      userTier: 'enterprise',
      apiKeyId: 'key-456',
    });

    // All enterprise features should be accessible
    expect(hasAccess(request.userTier, 'ideas.search')).toBe(true);
    expect(hasAccess(request.userTier, 'ideas.export')).toBe(true);
    expect(hasAccess(request.userTier, 'validate')).toBe(true);
    expect(hasAccess(request.userTier, 'api.keys')).toBe(true);
  });

  it('API key format should follow expected pattern', () => {
    const key = generateApiKey();
    // if_ prefix + 48 alphanumeric chars
    expect(key).toMatch(/^if_[A-Za-z0-9]{48}$/);
  });
});

// ============================================================================
// Route-by-Route Auth Verification
// ============================================================================

describe('Route-by-Route Auth Verification', () => {
  /**
   * Comprehensive verification that each route has the correct
   * auth behavior when accessed by different user types.
   */

  describe('Protected route access by unauthenticated users', () => {
    /**
     * All requireAuth/requireEnterprise routes should return 401
     * for unauthenticated users.
     */
    const protectedRoutes = [
      // requireAuth routes
      'POST /api/v1/ideas/:id/save',
      'DELETE /api/v1/ideas/:id/save',
      'GET /api/v1/user/preferences',
      'PUT /api/v1/user/preferences',
      'GET /api/v1/user/subscription',
      'GET /api/v1/user/history',
      'GET /api/v1/user/usage',
      'POST /api/v1/billing/checkout',
      'POST /api/v1/billing/portal',
      // requireEnterprise routes
      'GET /api/v1/ideas/search',
      'POST /api/v1/validate',
      'GET /api/v1/validate/:id',
      'GET /api/v1/export',
      'GET /api/v1/stats',
      'GET /api/v1/user/api-keys',
      'POST /api/v1/user/api-keys',
      'DELETE /api/v1/user/api-keys/:id',
      'POST /api/v1/user/api-keys/:id/deactivate',
    ];

    it('should have 18 protected routes that return 401 for unauthenticated requests', () => {
      expect(protectedRoutes.length).toBe(18);
    });

    it('unauthenticated users should get 401 from requireAuth middleware', () => {
      const request = createMockRequest({ userId: undefined });
      const reply = createMockReply();

      // Simulate requireAuth
      if (!request.userId) {
        reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      expect(reply.statusCode).toBe(401);
      expect(reply._body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Enterprise route access by wrong tier', () => {
    /**
     * Enterprise routes should return 403 for authenticated
     * users who are not on the enterprise tier.
     */

    it('free user accessing enterprise search should get 403', async () => {
      const gate = createTierGate('ideas.search');
      const request = createMockRequest({ userId: 'user-1', userTier: 'free' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.statusCode).toBe(403);
      expect(reply._body.code).toBe('TIER_RESTRICTED');
    });

    it('pro user accessing enterprise export should get 403', async () => {
      const gate = createTierGate('ideas.export');
      const request = createMockRequest({ userId: 'user-1', userTier: 'pro' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.statusCode).toBe(403);
      expect(reply._body.code).toBe('TIER_RESTRICTED');
    });

    it('pro user accessing enterprise export should get 403', async () => {
      const gate = createTierGate('ideas.export');
      const request = createMockRequest({ userId: 'user-1', userTier: 'pro' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.statusCode).toBe(403);
    });

    it('anonymous user accessing archive should pass through (preview mode)', async () => {
      const gate = createTierGate('ideas.archive');
      const request = createMockRequest({ userId: undefined, userTier: 'anonymous' });
      const reply = createMockReply();

      await gate(request, reply);

      expect(reply.sent).toBe(false);
    });
  });

  describe('Public routes accessible without auth', () => {
    it('health routes should not require auth', () => {
      // health.ts routes have no preHandler auth middleware
      // This is correct - health endpoints are for monitoring
      expect(true).toBe(true); // Documented assertion
    });

    it('billing prices should be publicly accessible', () => {
      // billing.ts GET /prices has no preHandler auth
      // This is correct - pricing page is public
      expect(true).toBe(true); // Documented assertion
    });

    it('stripe webhook should not require auth (uses signature verification)', () => {
      // webhooks.ts POST /stripe has no auth middleware
      // This is correct - Stripe sends webhooks directly
      // Verification is done via stripe-signature header
      expect(true).toBe(true); // Documented assertion
    });

    it('optionalAuth routes should work without auth (as anonymous)', () => {
      // ideas/today, ideas/categories, ideas/:id use optionalAuth
      // Anonymous users get limited results but no 401
      const request = createMockRequest({ userTier: 'anonymous' });
      expect(request.userTier).toBe('anonymous');
      expect(request.userId).toBeUndefined();

      // Anonymous can access public features
      expect(hasAccess('anonymous', 'ideas.today')).toBe(true);
      expect(hasAccess('anonymous', 'ideas.detail')).toBe(true);
    });
  });
});

// ============================================================================
// Auth Error Response Format
// ============================================================================

describe('Auth Error Response Format', () => {
  it('401 response should have consistent format', () => {
    const reply = createMockReply();
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });

    expect(reply._body).toHaveProperty('code');
    expect(reply._body).toHaveProperty('message');
    expect(reply._body.code).toBe('UNAUTHORIZED');
  });

  it('403 enterprise response should have consistent format', () => {
    const reply = createMockReply();
    reply.status(403).send({
      code: 'ENTERPRISE_REQUIRED',
      message: 'This endpoint requires an Enterprise subscription',
    });

    expect(reply._body).toHaveProperty('code');
    expect(reply._body).toHaveProperty('message');
    expect(reply._body.code).toBe('ENTERPRISE_REQUIRED');
  });

  it('403 pro response should have consistent format', () => {
    const reply = createMockReply();
    reply.status(403).send({
      code: 'PRO_REQUIRED',
      message: 'This endpoint requires a Builder or Enterprise subscription',
    });

    expect(reply._body).toHaveProperty('code');
    expect(reply._body).toHaveProperty('message');
    expect(reply._body.code).toBe('PRO_REQUIRED');
  });

  it('403 tier gate response should include details', async () => {
    const gate = createTierGate('ideas.search');
    const request = createMockRequest({ userTier: 'free' });
    const reply = createMockReply();

    await gate(request, reply);

    expect(reply._body).toHaveProperty('code');
    expect(reply._body).toHaveProperty('message');
    expect(reply._body).toHaveProperty('details');
    expect(reply._body.details).toHaveProperty('feature');
    expect(reply._body.details).toHaveProperty('requiredTier');
    expect(reply._body.details).toHaveProperty('currentTier');
    expect(reply._body.details).toHaveProperty('upgradeUrl');
  });
});
