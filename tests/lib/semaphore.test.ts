/**
 * Tests for the counting semaphore
 */

import { describe, it, expect } from 'vitest';
import { Semaphore } from '../../src/lib/semaphore';

describe('Semaphore', () => {
  it('throws if maxConcurrent < 1', () => {
    expect(() => new Semaphore(0)).toThrow('maxConcurrent must be >= 1');
    expect(() => new Semaphore(-1)).toThrow('maxConcurrent must be >= 1');
  });

  it('allows up to maxConcurrent acquires without blocking', async () => {
    const sem = new Semaphore(3);

    await sem.acquire();
    await sem.acquire();
    await sem.acquire();

    expect(sem.activeCount).toBe(3);
    expect(sem.queueLength).toBe(0);
  });

  it('queues waiters beyond maxConcurrent', async () => {
    const sem = new Semaphore(2);

    await sem.acquire();
    await sem.acquire();

    // These should not resolve yet
    let waiter1Resolved = false;
    let waiter2Resolved = false;
    const p1 = sem.acquire().then(() => { waiter1Resolved = true; });
    const p2 = sem.acquire().then(() => { waiter2Resolved = true; });

    // Let microtasks flush
    await Promise.resolve();

    expect(waiter1Resolved).toBe(false);
    expect(waiter2Resolved).toBe(false);
    expect(sem.queueLength).toBe(2);

    // Release one — first waiter should resolve (FIFO)
    sem.release();
    await p1;
    expect(waiter1Resolved).toBe(true);
    expect(waiter2Resolved).toBe(false);
    expect(sem.queueLength).toBe(1);

    // Release another — second waiter resolves
    sem.release();
    await p2;
    expect(waiter2Resolved).toBe(true);
    expect(sem.queueLength).toBe(0);
  });

  it('releases in FIFO order', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    const order: number[] = [];

    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));
    const p3 = sem.acquire().then(() => order.push(3));

    sem.release();
    await p1;
    sem.release();
    await p2;
    sem.release();
    await p3;

    expect(order).toEqual([1, 2, 3]);
  });

  it('works correctly under concurrent acquire/release pressure', async () => {
    const sem = new Semaphore(3);
    let maxObserved = 0;

    const task = async (id: number) => {
      await sem.acquire();
      const current = sem.activeCount;
      if (current > maxObserved) maxObserved = current;
      // Simulate async work
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      sem.release();
    };

    // Launch 20 tasks concurrently
    await Promise.all(Array.from({ length: 20 }, (_, i) => task(i)));

    expect(maxObserved).toBeLessThanOrEqual(3);
    expect(sem.activeCount).toBe(0);
    expect(sem.queueLength).toBe(0);
  });

  it('release without pending waiters decrements active count', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    expect(sem.activeCount).toBe(1);

    sem.release();
    expect(sem.activeCount).toBe(0);
  });
});
