/**
 * Unit tests for retry utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, retryable } from '../../src/scheduler/utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed eventually', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxAttempts: 3 });

    // Advance timers for each retry delay
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts exhausted', async () => {
    // Use real timers for this test to avoid promise/fake timer interaction issues
    vi.useRealTimers();

    const fn = vi.fn().mockImplementation(async () => {
      throw new Error('always fails');
    });

    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 20 })
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(2);

    // Restore fake timers for other tests
    vi.useFakeTimers();
  });

  it('should call onRetry callback on each retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const promise = withRetry(fn, { maxAttempts: 2, onRetry });

    await vi.advanceTimersByTimeAsync(2000);

    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('should respect maxDelayMs', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const startTime = Date.now();
    const promise = withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 100000, // Very high base delay
      maxDelayMs: 100, // But max is capped
    });

    await vi.advanceTimersByTimeAsync(200); // Should be enough with max cap

    await promise;

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('retryable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should wrap function with retry behavior', async () => {
    const originalFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const wrappedFn = retryable(originalFn, { maxAttempts: 2 });

    const promise = wrappedFn();

    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result).toBe('success');
    expect(originalFn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to wrapped function', async () => {
    const originalFn = vi.fn().mockResolvedValue('result');
    const wrappedFn = retryable(originalFn);

    await wrappedFn('arg1', 'arg2');

    expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});
