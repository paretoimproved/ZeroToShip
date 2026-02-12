/**
 * Tests for pipeline distributed lock
 *
 * All Redis interactions are mocked — no real connection is made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis module before importing the lock module
vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(),
}));

import { getRedisClient } from '../../src/lib/redis';
import {
  acquirePipelineLock,
  releasePipelineLock,
  getPipelineLockInfo,
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

  it('returns true (graceful degradation) when Redis client is null', async () => {
    mockGetRedisClient.mockReturnValue(null);

    const result = await acquirePipelineLock('run_abc');

    expect(result).toBe(true);
  });

  it('returns true (graceful degradation) when Redis throws', async () => {
    const redis = createMockRedis();
    redis.set.mockRejectedValue(new Error('Connection refused'));
    mockGetRedisClient.mockReturnValue(redis as never);

    const result = await acquirePipelineLock('run_err');

    expect(result).toBe(true);
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

  it('does nothing when Redis client is null', async () => {
    mockGetRedisClient.mockReturnValue(null);

    // Should not throw
    await releasePipelineLock('run_abc');
  });

  it('silently swallows Redis errors', async () => {
    const redis = createMockRedis();
    redis.eval.mockRejectedValue(new Error('Connection refused'));
    mockGetRedisClient.mockReturnValue(redis as never);

    // Should not throw
    await releasePipelineLock('run_err');
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
