/**
 * Tests for pipeline distributed lock
 *
 * All Redis interactions are mocked — no real connection is made.
 * The postgres module is mocked so the DB advisory lock fallback
 * doesn't attempt real connections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis module before importing the lock module
vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(),
}));

// Mock postgres so DB fallback doesn't hit a real connection.
// Returns a tagged-template function that can be called like client`SQL`.
const mockPostgresQuery = vi.fn();
vi.mock('postgres', () => ({
  default: vi.fn(() => Object.assign(mockPostgresQuery, {
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock env config for databaseUrl
vi.mock('../../src/config/env', () => ({
  config: {
    databaseUrl: 'postgres://test:test@localhost:5432/test',
    isProduction: false,
  },
}));

import { getRedisClient } from '../../src/lib/redis';
import {
  acquirePipelineLock,
  extendPipelineLock,
  releasePipelineLock,
  getPipelineLockInfo,
  closeLockClient,
} from '../../src/lib/pipeline-lock';

const mockGetRedisClient = vi.mocked(getRedisClient);

function createMockRedis() {
  return {
    set: vi.fn(),
    get: vi.fn(),
    ttl: vi.fn(),
    eval: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('acquirePipelineLock', () => {
  it('returns true when lock is acquired successfully', async () => {
    const redis = createMockRedis();
    redis.set.mockResolvedValue('OK');
    mockGetRedisClient.mockReturnValue(redis as never);

    const result = await acquirePipelineLock('run_123');

    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'pipeline:lock',
      'run_123',
      'EX',
      600,
      'NX',
    );
  });

  it('returns false when lock is already held', async () => {
    const redis = createMockRedis();
    redis.set.mockResolvedValue(null);
    mockGetRedisClient.mockReturnValue(redis as never);

    const result = await acquirePipelineLock('run_456');

    expect(result).toBe(false);
  });

  it('uses custom TTL when provided', async () => {
    const redis = createMockRedis();
    redis.set.mockResolvedValue('OK');
    mockGetRedisClient.mockReturnValue(redis as never);

    await acquirePipelineLock('run_789', 300);

    expect(redis.set).toHaveBeenCalledWith(
      'pipeline:lock',
      'run_789',
      'EX',
      300,
      'NX',
    );
  });

  it('falls back to PG advisory lock when Redis client is null', async () => {
    mockGetRedisClient.mockReturnValue(null);
    mockPostgresQuery.mockResolvedValue([{ locked: true }]);

    const result = await acquirePipelineLock('run_abc');

    expect(result).toBe(true);
  });

  it('returns true (graceful degradation) when Redis throws and DB also fails', async () => {
    const redis = createMockRedis();
    redis.set.mockRejectedValue(new Error('Connection refused'));
    mockGetRedisClient.mockReturnValue(redis as never);
    mockPostgresQuery.mockRejectedValue(new Error('DB unreachable'));

    const result = await acquirePipelineLock('run_err');

    expect(result).toBe(true);
  });

  it('returns false when PG advisory lock is already held', async () => {
    mockGetRedisClient.mockReturnValue(null);
    mockPostgresQuery.mockResolvedValue([{ locked: false }]);

    const result = await acquirePipelineLock('run_held');

    expect(result).toBe(false);
  });
});

describe('releasePipelineLock', () => {
  it('calls eval with Lua script and matching runId', async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(1);
    mockGetRedisClient.mockReturnValue(redis as never);

    await releasePipelineLock('run_123');

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("get"'),
      1,
      'pipeline:lock',
      'run_123',
    );
  });

  it('releases PG advisory lock when Redis client is null', async () => {
    mockGetRedisClient.mockReturnValue(null);
    mockPostgresQuery.mockResolvedValue([{ pg_advisory_unlock: true }]);

    await releasePipelineLock('run_abc');

    expect(mockPostgresQuery).toHaveBeenCalled();
  });

  it('silently swallows Redis errors', async () => {
    const redis = createMockRedis();
    redis.eval.mockRejectedValue(new Error('Connection refused'));
    mockGetRedisClient.mockReturnValue(redis as never);

    // Should not throw
    await releasePipelineLock('run_err');
  });
});

describe('extendPipelineLock', () => {
  it('extends lock TTL when runId still owns the lock', async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(1);
    mockGetRedisClient.mockReturnValue(redis as never);

    const result = await extendPipelineLock('run_123');

    expect(result).toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("expire"'),
      1,
      'pipeline:lock',
      'run_123',
      '600',
    );
  });

  it('returns false when lock ownership is lost', async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(0);
    mockGetRedisClient.mockReturnValue(redis as never);

    const result = await extendPipelineLock('run_123');

    expect(result).toBe(false);
  });

  it('uses custom TTL when provided', async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(1);
    mockGetRedisClient.mockReturnValue(redis as never);

    await extendPipelineLock('run_123', 300);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'pipeline:lock',
      'run_123',
      '300',
    );
  });

  it('returns true (graceful degradation) when Redis client is null', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const result = await extendPipelineLock('run_abc');

    expect(result).toBe(true);
  });

  it('returns true (graceful degradation) when Redis throws', async () => {
    const redis = createMockRedis();
    redis.eval.mockRejectedValue(new Error('Connection refused'));
    mockGetRedisClient.mockReturnValue(redis as never);

    const result = await extendPipelineLock('run_err');

    expect(result).toBe(true);
  });
});

describe('getPipelineLockInfo', () => {
  it('returns locked=true with runId and ttl when lock is held', async () => {
    const redis = createMockRedis();
    redis.get.mockResolvedValue('run_123');
    redis.ttl.mockResolvedValue(542);
    mockGetRedisClient.mockReturnValue(redis as never);

    const info = await getPipelineLockInfo();

    expect(info).toEqual({ locked: true, runId: 'run_123', ttl: 542 });
  });

  it('returns locked=false when no lock is held', async () => {
    const redis = createMockRedis();
    redis.get.mockResolvedValue(null);
    redis.ttl.mockResolvedValue(-2);
    mockGetRedisClient.mockReturnValue(redis as never);

    const info = await getPipelineLockInfo();

    expect(info).toEqual({ locked: false });
  });

  it('returns locked=false when Redis is unavailable', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const info = await getPipelineLockInfo();

    expect(info).toEqual({ locked: false });
  });

  it('returns locked=false when Redis throws', async () => {
    const redis = createMockRedis();
    redis.get.mockRejectedValue(new Error('Connection refused'));
    mockGetRedisClient.mockReturnValue(redis as never);

    const info = await getPipelineLockInfo();

    expect(info).toEqual({ locked: false });
  });
});

describe('closeLockClient', () => {
  it('does not throw when called without prior lock usage', async () => {
    await expect(closeLockClient()).resolves.toBeUndefined();
  });
});
