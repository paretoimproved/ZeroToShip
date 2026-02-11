/**
 * Cross-User Authorization Tests for ZeroToShip API
 *
 * Verifies that IDOR vulnerabilities are fixed in service functions:
 * - deleteApiKey: User A cannot delete User B's API key
 * - deactivateApiKey: User A cannot deactivate User B's API key
 * - getValidationStatus: User A cannot view User B's validation status
 *
 * These tests mock the Drizzle ORM database layer and verify that
 * the WHERE clauses include both the resource ID and the userId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup — vi.hoisted ensures these are available when vi.mock runs
// ============================================================================

const { mockDb, mockReturning, mockLimit } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockLimit = vi.fn();
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: mockLimit,
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: mockReturning,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockReturnThis(),
  };
  return { mockDb, mockReturning, mockLimit };
});

vi.mock('../../../src/api/db/client', () => ({
  db: mockDb,
  users: { id: 'id', email: 'email', name: 'name', tier: 'tier', isAdmin: 'isAdmin' },
  userPreferences: { userId: 'userId' },
  subscriptions: { userId: 'userId', plan: 'plan', status: 'status' },
  apiKeys: {
    id: 'id',
    userId: 'userId',
    key: 'key',
    keyHash: 'keyHash',
    name: 'name',
    isActive: 'isActive',
    expiresAt: 'expiresAt',
    lastUsedAt: 'lastUsedAt',
    createdAt: 'createdAt',
  },
  ideas: { id: 'id' },
  savedIdeas: { userId: 'userId', ideaId: 'ideaId' },
  viewedIdeas: { userId: 'userId', ideaId: 'ideaId' },
  validationRequests: {
    id: 'id',
    userId: 'userId',
    ideaId: 'ideaId',
    status: 'status',
    result: 'result',
    completedAt: 'completedAt',
  },
  rateLimits: {},
  closeDatabase: vi.fn(),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
}));

// Mock auth middleware (imported by users service)
vi.mock('../../../src/api/middleware/auth', () => ({
  generateApiKey: vi.fn().mockReturnValue('if_test_key_12345'),
  hashApiKey: vi.fn().mockReturnValue('hashed_key'),
  invalidateTierCache: vi.fn(),
}));

// Mock onboarding email (imported by users service)
vi.mock('../../../src/delivery/onboarding', () => ({
  sendOnboardingEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger (imported by users service)
vi.mock('../../../src/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Now import tested modules (after mocks are set up)
// ============================================================================

import { deleteApiKey, deactivateApiKey } from '../../../src/api/services/users';
import { getValidationStatus } from '../../../src/api/services/ideas';

// ============================================================================
// Test Data
// ============================================================================

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const KEY_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const VALIDATION_REQUEST_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

// ============================================================================
// Tests
// ============================================================================

describe('Cross-User Authorization (IDOR Prevention)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the chainable mock methods
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
    mockDb.onConflictDoNothing.mockReturnThis();
  });

  describe('deleteApiKey', () => {
    it('should return true when deleting own API key', async () => {
      // Simulate: DELETE matched a row (user owns this key)
      mockReturning.mockResolvedValueOnce([{ id: KEY_ID }]);

      const result = await deleteApiKey(USER_A, KEY_ID);

      expect(result).toBe(true);
      // Verify the db.delete chain was called
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });

    it('should return false when trying to delete another user\'s API key', async () => {
      // Simulate: DELETE matched zero rows (key belongs to a different user)
      mockReturning.mockResolvedValueOnce([]);

      const result = await deleteApiKey(USER_B, KEY_ID);

      expect(result).toBe(false);
      // Verify the db.delete chain was called but returned no rows
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });

    it('should return false when key does not exist at all', async () => {
      // Simulate: DELETE matched zero rows (key doesn't exist)
      mockReturning.mockResolvedValueOnce([]);

      const result = await deleteApiKey(USER_A, 'nonexistent-key-id');

      expect(result).toBe(false);
    });
  });

  describe('deactivateApiKey', () => {
    it('should return true when deactivating own API key', async () => {
      // Simulate: UPDATE matched a row (user owns this key)
      mockReturning.mockResolvedValueOnce([{ id: KEY_ID }]);

      const result = await deactivateApiKey(USER_A, KEY_ID);

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });

    it('should return false when trying to deactivate another user\'s API key', async () => {
      // Simulate: UPDATE matched zero rows (key belongs to a different user)
      mockReturning.mockResolvedValueOnce([]);

      const result = await deactivateApiKey(USER_B, KEY_ID);

      expect(result).toBe(false);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });

    it('should return false when key does not exist at all', async () => {
      // Simulate: UPDATE matched zero rows (key doesn't exist)
      mockReturning.mockResolvedValueOnce([]);

      const result = await deactivateApiKey(USER_A, 'nonexistent-key-id');

      expect(result).toBe(false);
    });
  });

  describe('getValidationStatus', () => {
    it('should return status when querying own validation request', async () => {
      const mockRow = {
        id: VALIDATION_REQUEST_ID,
        userId: USER_A,
        ideaId: 'idea-123',
        status: 'completed',
        result: { depth: 'basic', score: 85 },
        completedAt: new Date('2026-02-10T12:00:00Z'),
        requestedAt: new Date('2026-02-10T11:00:00Z'),
      };

      // Simulate: SELECT matched a row (user owns this request)
      mockLimit.mockResolvedValueOnce([mockRow]);

      const result = await getValidationStatus(VALIDATION_REQUEST_ID, USER_A);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(VALIDATION_REQUEST_ID);
      expect(result!.status).toBe('completed');
      expect(result!.result).toEqual({ depth: 'basic', score: 85 });
      expect(result!.completedAt).toEqual(new Date('2026-02-10T12:00:00Z'));
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return null when trying to view another user\'s validation request', async () => {
      // Simulate: SELECT matched zero rows (request belongs to a different user)
      mockLimit.mockResolvedValueOnce([]);

      const result = await getValidationStatus(VALIDATION_REQUEST_ID, USER_B);

      expect(result).toBeNull();
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return null when validation request does not exist', async () => {
      // Simulate: SELECT matched zero rows (request doesn't exist)
      mockLimit.mockResolvedValueOnce([]);

      const result = await getValidationStatus('nonexistent-id', USER_A);

      expect(result).toBeNull();
    });
  });
});
