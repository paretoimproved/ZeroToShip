/**
 * Counting semaphore for limiting concurrent async operations.
 *
 * Used by the Anthropic API client to cap in-flight HTTP calls and
 * prevent rate-limit cascades during graph-mode generation.
 */

export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error('Semaphore maxConcurrent must be >= 1');
    }
  }

  get activeCount(): number {
    return this.active;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the slot directly to the next waiter (FIFO)
      next();
    } else {
      this.active--;
    }
  }
}
