/**
 * End-to-End Auth Route Tests for ZeroToShip API
 *
 * Tests the actual auth routes (signup, login, me) through Fastify's
 * inject() method with mocked Supabase and database dependencies.
 *
 * Covers:
 * 1. POST /api/v1/auth/signup — happy path, duplicate email, validation errors
 * 2. POST /api/v1/auth/login  — happy path, wrong password, missing fields
 * 3. GET  /api/v1/auth/me     — authenticated, unauthenticated, user not found
 * 4. Auth flow integration    — signup → login → me round-trip
 * 5. Edge cases               — malformed JSON, Supabase down, empty token
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// Mock Setup — must be before any imports that use these modules
// ============================================================================

// Mock Supabase client
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignInWithIdToken = vi.fn();
const mockGetUser = vi.fn();
const mockAdminUpdateUserById = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signInWithIdToken: mockSignInWithIdToken,
      getUser: mockGetUser,
      admin: {
        updateUserById: mockAdminUpdateUserById,
      },
    },
  }),
}));

// Mock database client — prevent actual DB connections
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
  users: { id: 'id', email: 'email', name: 'name', isAdmin: 'isAdmin' },
  userPreferences: { userId: 'userId' },
  subscriptions: {
    userId: 'userId',
    plan: 'plan',
    status: 'status',
  },
  apiKeys: {
    id: 'id',
    userId: 'userId',
    keyHash: 'keyHash',
    keyPrefix: 'keyPrefix',
    isActive: 'isActive',
    expiresAt: 'expiresAt',
    lastUsedAt: 'lastUsedAt',
  },
  rateLimits: {},
  viewedIdeas: {},
  savedIdeas: {},
  closeDatabase: vi.fn(),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
}));

// Mock user services
const mockGetOrCreateUser = vi.fn();
const mockGetUserById = vi.fn();
const mockGetUserTierById = vi.fn();

vi.mock('../../src/api/services/users', () => ({
  getOrCreateUser: (...args: unknown[]) => mockGetOrCreateUser(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
  getUserTierById: (...args: unknown[]) => mockGetUserTierById(...args),
  getUserPreferences: vi.fn().mockResolvedValue(null),
  updateUserPreferences: vi.fn().mockResolvedValue(null),
  getUserSubscription: vi.fn().mockResolvedValue(null),
  getUserHistory: vi.fn().mockResolvedValue({ viewed: [], saved: [] }),
  getUserApiKeys: vi.fn().mockResolvedValue([]),
  createApiKey: vi.fn().mockResolvedValue(null),
  deleteApiKey: vi.fn().mockResolvedValue(false),
  deactivateApiKey: vi.fn().mockResolvedValue(false),
}));

// Mock usage service
vi.mock('../../src/api/services/usage', () => ({
  getUsageStatus: vi.fn().mockResolvedValue({
    freshBriefsUsed: 0,
    freshBriefsLimit: 0,
    freshBriefsRemaining: 0,
    validationRequestsUsed: 0,
    validationRequestsLimit: 0,
    validationRequestsRemaining: 0,
    overageBriefs: 0,
    overageAmountCents: 0,
    canRequestFreshBrief: false,
    canRequestValidation: false,
    wouldIncurOverage: false,
    resetAt: new Date().toISOString(),
  }),
}));

// Mock billing service
vi.mock('../../src/api/services/billing', () => ({
  createCheckoutSession: vi.fn().mockResolvedValue(null),
  createPortalSession: vi.fn().mockResolvedValue(null),
  getStripePrices: vi.fn().mockResolvedValue([]),
  handleStripeWebhook: vi.fn().mockResolvedValue(undefined),
}));

// Mock ideas service
vi.mock('../../src/api/services/ideas', () => ({
  getTodayIdeas: vi.fn().mockResolvedValue([]),
  getIdeaById: vi.fn().mockResolvedValue(null),
  getIdeaCategories: vi.fn().mockResolvedValue([]),
  getArchiveIdeas: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  saveIdea: vi.fn().mockResolvedValue(true),
  unsaveIdea: vi.fn().mockResolvedValue(true),
  searchIdeas: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  exportIdeas: vi.fn().mockResolvedValue([]),
}));

// Mock config — provide Supabase env vars so the supabase client is created
vi.mock('../../src/config/env', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'error',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: '',
    SUPABASE_DB_URL: '',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    RESEND_API_KEY: '',
    GITHUB_TOKEN: undefined,
    TWITTER_BEARER_TOKEN: undefined,
    NITTER_INSTANCES: undefined,
    SERPAPI_KEY: '',
    BRAVE_API_KEY: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    STRIPE_PRICE_PRO_MONTHLY: '',
    STRIPE_PRICE_PRO_YEARLY: '',
    STRIPE_PRICE_ENT_MONTHLY: '',
    STRIPE_PRICE_ENT_YEARLY: '',
    CHECKOUT_SUCCESS_URL: 'http://localhost:3000/account?session_id={CHECKOUT_SESSION_ID}',
    CHECKOUT_CANCEL_URL: 'http://localhost:3000/pricing',
    BILLING_PORTAL_RETURN_URL: 'http://localhost:3000/account',
    ADMIN_EMAILS: '',
    REDIS_URL: undefined,
    SCHEDULER_CRON: '0 6 * * *',
    SCHEDULER_TIMEZONE: 'America/New_York',
    SCHEDULER_ENABLED: true,
    // Derived AppConfig fields
    databaseUrl: '',
    isProduction: false,
    isTest: true,
    logLevel: 'error',
    corsOrigins: ['http://localhost:3000'],
    nitterInstances: undefined,
    adminEmails: new Set(),
  },
}));

// Mock rate limit middleware
vi.mock('../../src/api/middleware/rateLimit', () => ({
  rateLimitMiddleware: vi.fn().mockImplementation(async () => {}),
  createTierRateLimit: vi.fn().mockReturnValue(async () => {}),
  clearRateLimit: vi.fn(),
}));

// Mock lib/errors
vi.mock('../../src/lib/errors', () => {
  class ApiError extends Error {
    statusCode: number;
    severity: string;
    context: Record<string, unknown>;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.severity = 'error';
      this.context = {};
    }
  }
  return {
    ApiError,
    isZeroToShipError: (err: unknown) =>
      err instanceof Error && 'severity' in err && 'phase' in err,
  };
});

// Mock stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: { constructEvent: vi.fn() },
    })),
  };
});

// Mock enterprise routes
vi.mock('../../src/api/routes/enterprise', () => ({
  enterpriseRoutes: vi.fn().mockImplementation(async () => {}),
}));

// Mock admin routes
vi.mock('../../src/api/routes/admin', () => ({
  adminRoutes: vi.fn().mockImplementation(async () => {}),
}));

// Mock global fetch for Google token exchange
const originalFetch = globalThis.fetch;
const mockGlobalFetch = vi.fn();

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_USER = {
  id: 'user-uuid-123',
  email: 'test@zerotoship.dev',
  name: 'Test User',
  isAdmin: false,
};

const TEST_SESSION = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token',
  refresh_token: 'refresh-token-123',
  expires_in: 3600,
  token_type: 'bearer',
};

function supabaseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_USER.id,
    email: TEST_USER.email,
    email_confirmed_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Auth Routes E2E', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    mockGlobalFetch.mockReset();

    // Install fetch mock for Google token exchange
    globalThis.fetch = mockGlobalFetch;

    // Default: let Fastify's own inject pass through, only mock external calls
    mockGlobalFetch.mockImplementation((...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      if (url.includes('oauth2.googleapis.com')) {
        // Return mock response — individual tests override this
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'not_configured' }),
        });
      }
      // Fallback to original fetch for non-Google calls
      return originalFetch(...args);
    });

    // Default: getUserTierById returns 'free'
    mockGetUserTierById.mockResolvedValue('free');

    // Import server factory fresh (mocks are already in place)
    const { createServer } = await import('../../src/api/server');
    server = await createServer({ logger: false });
    await server.ready();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    globalThis.fetch = originalFetch;
  });

  // ==========================================================================
  // POST /api/v1/auth/signup
  // ==========================================================================

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user and return token + user object', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: {
            access_token: TEST_SESSION.access_token,
            refresh_token: TEST_SESSION.refresh_token,
          },
        },
        error: null,
      });

      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
          name: TEST_USER.name,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.token).toBe(TEST_SESSION.access_token);
      expect(body.user.id).toBe(TEST_USER.id);
      expect(body.user.email).toBe(TEST_USER.email);
      expect(body.user.name).toBe(TEST_USER.name);
      expect(body.user.tier).toBe('free');
    });

    it('should call Supabase signUp with correct credentials', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: TEST_SESSION.access_token },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'new@example.com',
          password: 'mypassword',
          name: 'New User',
        },
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'mypassword',
      });
    });

    it('should call getOrCreateUser with Supabase user id, email, and name', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: TEST_SESSION.access_token },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
          name: TEST_USER.name,
        },
      });

      expect(mockGetOrCreateUser).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_USER.email,
        TEST_USER.name
      );
    });

    it('should auto-confirm and sign in when no session returned', async () => {
      // Supabase returns user but no session when email confirmation is required
      mockSignUp.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: null,
        },
        error: null,
      });

      // Admin auto-confirm succeeds
      mockAdminUpdateUserById.mockResolvedValue({ data: {}, error: null });

      // signInWithPassword succeeds after auto-confirm
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: 'fallback-token' },
        },
        error: null,
      });

      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
          name: TEST_USER.name,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.token).toBe('fallback-token');
      expect(mockAdminUpdateUserById).toHaveBeenCalledWith(
        TEST_USER.id,
        { email_confirm: true }
      );
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: TEST_USER.email,
        password: 'securepass123',
      });
    });

    it('should return 500 when auto-confirm succeeds but sign-in still fails', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: supabaseUser({ email_confirmed_at: null }),
          session: null,
        },
        error: null,
      });

      // Admin auto-confirm succeeds
      mockAdminUpdateUserById.mockResolvedValue({ data: {}, error: null });

      // signInWithPassword fails despite auto-confirm
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
          name: TEST_USER.name,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('SIGNUP_SESSION_FAILED');
    });

    it('should return 400 when Supabase signup fails', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'existing@example.com',
          password: 'password123',
          name: 'Existing User',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('SIGNUP_FAILED');
      expect(body.message).toBe('User already registered');
    });

    it('should return 400 when Supabase returns no user', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'ghost@example.com',
          password: 'password123',
          name: 'Ghost',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('SIGNUP_FAILED');
      expect(body.message).toBe('Failed to create user account');
    });

    it('should return 500 when Supabase throws an exception', async () => {
      mockSignUp.mockRejectedValue(new Error('Connection refused'));

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('AUTH_SERVICE_ERROR');
      expect(body.message).toBe('Connection refused');
    });

    it('should return 400 for missing email field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          password: 'password123',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'not-an-email',
          password: 'password123',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'test@example.com',
          password: '12345',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing name field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty name', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should sanitize control characters in error messages', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Bad\x00Input\x1FHere' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('BadInputHere');
      expect(body.message).not.toMatch(/[\x00-\x1F]/);
    });
  });

  // ==========================================================================
  // POST /api/v1/auth/login
  // ==========================================================================

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate user and return token + user object', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: {
            access_token: TEST_SESSION.access_token,
          },
        },
        error: null,
      });

      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.token).toBe(TEST_SESSION.access_token);
      expect(body.user.id).toBe(TEST_USER.id);
      expect(body.user.email).toBe(TEST_USER.email);
      expect(body.user.tier).toBe('free');
    });

    it('should call Supabase signInWithPassword with correct credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: TEST_SESSION.access_token },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'user@example.com',
          password: 'thepassword',
        },
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'thepassword',
      });
    });

    it('should return 401 for invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('LOGIN_FAILED');
      expect(body.message).toBe('Invalid login credentials');
    });

    it('should return 401 when Supabase returns no user or session', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('LOGIN_FAILED');
      expect(body.message).toBe('Invalid credentials');
    });

    it('should return 401 for unconfirmed email', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'unconfirmed@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('LOGIN_FAILED');
      expect(body.message).toBe('Email not confirmed');
    });

    it('should return 500 when Supabase throws an exception', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Service unavailable'));

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('AUTH_SERVICE_ERROR');
      expect(body.message).toBe('Service unavailable');
    });

    it('should return 400 for missing email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: '12345',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'notavalidemail',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should sanitize control characters in login error messages', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Error\x00with\x7Fchars' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).not.toMatch(/[\x00-\x1F\x7F]/);
    });
  });

  // ==========================================================================
  // POST /api/v1/auth/google
  // ==========================================================================

  describe('POST /api/v1/auth/google', () => {
    it('should exchange Google auth code and return token + user', async () => {
      // Mock Google token exchange
      mockGlobalFetch.mockImplementation((...args: Parameters<typeof fetch>) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (url.includes('oauth2.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id_token: 'google-id-token-123' }),
          });
        }
        return originalFetch(...args);
      });

      // Mock Supabase signInWithIdToken
      mockSignInWithIdToken.mockResolvedValue({
        data: {
          user: {
            ...supabaseUser(),
            user_metadata: { full_name: 'Google User' },
          },
          session: { access_token: TEST_SESSION.access_token },
        },
        error: null,
      });

      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { code: 'google-auth-code-456' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.token).toBe(TEST_SESSION.access_token);
      expect(body.user.id).toBe(TEST_USER.id);
      expect(body.user.email).toBe(TEST_USER.email);
      expect(body.user.tier).toBe('free');
    });

    it('should call Google token endpoint with correct parameters', async () => {
      mockGlobalFetch.mockImplementation((...args: Parameters<typeof fetch>) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (url.includes('oauth2.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id_token: 'google-id-token' }),
          });
        }
        return originalFetch(...args);
      });

      mockSignInWithIdToken.mockResolvedValue({
        data: {
          user: { ...supabaseUser(), user_metadata: {} },
          session: { access_token: 'token' },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { code: 'test-code' },
      });

      // Verify Google was called with the right body
      const googleCall = mockGlobalFetch.mock.calls.find(
        (call: Parameters<typeof fetch>) => {
          const url = typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
          return url.includes('oauth2.googleapis.com');
        }
      );
      expect(googleCall).toBeDefined();
      const requestBody = JSON.parse((googleCall![1] as RequestInit).body as string);
      expect(requestBody.code).toBe('test-code');
      expect(requestBody.client_id).toBe('test-google-client-id');
      expect(requestBody.client_secret).toBe('test-google-client-secret');
      expect(requestBody.redirect_uri).toBe('postmessage');
      expect(requestBody.grant_type).toBe('authorization_code');
    });

    it('should return 400 when Google code exchange fails', async () => {
      mockGlobalFetch.mockImplementation((...args: Parameters<typeof fetch>) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (url.includes('oauth2.googleapis.com')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'invalid_grant' }),
          });
        }
        return originalFetch(...args);
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { code: 'expired-code' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('GOOGLE_EXCHANGE_FAILED');
    });

    it('should return 400 when Supabase signInWithIdToken fails', async () => {
      mockGlobalFetch.mockImplementation((...args: Parameters<typeof fetch>) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (url.includes('oauth2.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id_token: 'google-id-token' }),
          });
        }
        return originalFetch(...args);
      });

      mockSignInWithIdToken.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid ID token' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { code: 'valid-code' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('GOOGLE_LOGIN_FAILED');
      expect(body.message).toBe('Invalid ID token');
    });

    it('should return 400 for missing code field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should call signInWithIdToken with the Google id_token', async () => {
      mockGlobalFetch.mockImplementation((...args: Parameters<typeof fetch>) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (url.includes('oauth2.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id_token: 'specific-id-token' }),
          });
        }
        return originalFetch(...args);
      });

      mockSignInWithIdToken.mockResolvedValue({
        data: {
          user: { ...supabaseUser(), user_metadata: {} },
          session: { access_token: 'token' },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { code: 'code-123' },
      });

      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'specific-id-token',
      });
    });
  });

  // ==========================================================================
  // GET /api/v1/auth/me
  // ==========================================================================

  describe('GET /api/v1/auth/me', () => {
    it('should return user data for authenticated user', async () => {
      // Mock JWT verification
      mockGetUser.mockResolvedValue({
        data: {
          user: supabaseUser(),
        },
        error: null,
      });

      mockGetUserById.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${TEST_SESSION.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.id).toBe(TEST_USER.id);
      expect(body.email).toBe(TEST_USER.email);
      expect(body.name).toBe(TEST_USER.name);
      expect(body.tier).toBe('free');
      expect(body.isAdmin).toBe(false);
    });

    it('should return isAdmin true for admin users', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: supabaseUser() },
        error: null,
      });
      mockGetUserById.mockResolvedValue({ ...TEST_USER, isAdmin: true });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${TEST_SESSION.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.isAdmin).toBe(true);
    });

    it('should call Supabase getUser with the Bearer token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: supabaseUser() },
        error: null,
      });
      mockGetUserById.mockResolvedValue(TEST_USER);

      await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer my-jwt-token`,
        },
      });

      expect(mockGetUser).toHaveBeenCalledWith('my-jwt-token');
    });

    it('should return 401 when no Authorization header is provided', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('UNAUTHORIZED');
      expect(body.message).toBe('Authentication required');
    });

    it('should return 401 for invalid token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for expired token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer expired-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should auto-create user when not found in database (first OAuth login)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: supabaseUser() },
        error: null,
      });

      // User exists in Supabase but not in our DB — triggers auto-creation
      mockGetUserById.mockResolvedValue(null);
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${TEST_SESSION.access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetOrCreateUser).toHaveBeenCalled();
    });

    it('should return 401 when Authorization header has wrong scheme', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for empty Bearer token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer ',
        },
      });

      // Empty token will fail Supabase verification
      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when Supabase getUser throws', async () => {
      mockGetUser.mockRejectedValue(new Error('Network error'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${TEST_SESSION.access_token}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // Full Auth Flow Integration
  // ==========================================================================

  describe('Auth Flow Integration', () => {
    it('should complete signup → login → me round-trip', async () => {
      const token = 'jwt-for-new-user';

      // Step 1: Signup
      mockSignUp.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: token },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const signupRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
          name: TEST_USER.name,
        },
      });

      expect(signupRes.statusCode).toBe(200);
      const signupBody = JSON.parse(signupRes.payload);
      expect(signupBody.token).toBe(token);

      // Step 2: Login with same credentials
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: token },
        },
        error: null,
      });

      const loginRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const loginBody = JSON.parse(loginRes.payload);
      expect(loginBody.token).toBe(token);
      expect(loginBody.user.id).toBe(signupBody.user.id);

      // Step 3: Access /me with the token
      mockGetUser.mockResolvedValue({
        data: { user: supabaseUser() },
        error: null,
      });
      mockGetUserById.mockResolvedValue(TEST_USER);

      const meRes = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(meRes.statusCode).toBe(200);
      const meBody = JSON.parse(meRes.payload);
      expect(meBody.id).toBe(TEST_USER.id);
      expect(meBody.email).toBe(TEST_USER.email);
    });

    it('should reject /me after using an invalid token', async () => {
      // Login succeeds
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: 'valid-token' },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const loginRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
        },
      });
      expect(loginRes.statusCode).toBe(200);

      // But /me is called with a different (invalid) token
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const meRes = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer tampered-token',
        },
      });

      expect(meRes.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle malformed JSON request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'content-type': 'application/json',
        },
        payload: '{ invalid json }',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'content-type': 'application/json',
        },
        payload: '{}',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle extra fields in request body gracefully', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: TEST_SESSION.access_token },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
          extra_field: 'should be ignored',
        },
      });

      // Should succeed (Zod strips unknown fields by default)
      expect(response.statusCode).toBe(200);
    });

    it('should not leak stack traces in error responses', async () => {
      mockSignUp.mockRejectedValue(new Error('Internal failure'));

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
        },
      });

      const body = JSON.parse(response.payload);
      expect(body).not.toHaveProperty('stack');
      expect(body).not.toHaveProperty('trace');
    });
  });

  // ==========================================================================
  // Response Format Verification
  // ==========================================================================

  describe('Response Format', () => {
    it('signup success response should match AuthResponseSchema shape', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: TEST_SESSION.access_token },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
          name: TEST_USER.name,
        },
      });

      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('id');
      expect(body.user).toHaveProperty('email');
      expect(body.user).toHaveProperty('name');
      expect(body.user).toHaveProperty('tier');
      expect(typeof body.token).toBe('string');
      expect(typeof body.user.id).toBe('string');
      expect(typeof body.user.email).toBe('string');
    });

    it('login success response should match AuthResponseSchema shape', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: supabaseUser(),
          session: { access_token: TEST_SESSION.access_token },
        },
        error: null,
      });
      mockGetOrCreateUser.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: TEST_USER.email,
          password: 'securepass123',
        },
      });

      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('id');
      expect(body.user).toHaveProperty('email');
      expect(body.user).toHaveProperty('name');
      expect(body.user).toHaveProperty('tier');
    });

    it('me success response should match UserResponseSchema shape', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: supabaseUser() },
        error: null,
      });
      mockGetUserById.mockResolvedValue(TEST_USER);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${TEST_SESSION.access_token}`,
        },
      });

      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('email');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('tier');
      // Should NOT have token (me endpoint only returns user)
      expect(body).not.toHaveProperty('token');
    });

    it('error responses should have code and message fields', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Bad credentials' },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpass',
        },
      });

      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('message');
      expect(typeof body.code).toBe('string');
      expect(typeof body.message).toBe('string');
    });
  });

  // ==========================================================================
  // HTTP Method Verification
  // ==========================================================================

  describe('HTTP Method Constraints', () => {
    it('GET /auth/signup should return 404', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/signup',
      });

      expect(response.statusCode).toBe(404);
    });

    it('GET /auth/login should return 404', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/login',
      });

      expect(response.statusCode).toBe(404);
    });

    it('POST /auth/me should return 404', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(404);
    });

    it('PUT /auth/me should return 404', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(404);
    });

    it('DELETE /auth/me should return 404', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
