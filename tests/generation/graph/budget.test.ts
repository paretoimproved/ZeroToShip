import { describe, expect, it, beforeEach } from 'vitest';
import { getGlobalMetrics, resetGlobalMetrics } from '../../../src/scheduler/utils/api-metrics';
import { GraphBudgetManager } from '../../../src/generation/graph/budget';

describe('GraphBudgetManager', () => {
  beforeEach(() => {
    resetGlobalMetrics();
  });

  it('allows briefs when under budget', () => {
    const mgr = new GraphBudgetManager({ runBudgetTokens: 10_000 });
    expect(mgr.canStartNextBrief()).toBe(true);
    expect(mgr.getBlockReason()).toBe(null);
  });

  it('blocks when token budget is exceeded (brief-generator module only)', () => {
    const metrics = getGlobalMetrics();
    metrics.recordCall({
      timestamp: new Date(),
      module: 'brief-generator',
      model: 'claude-haiku-4-5-20251001',
      batchSize: 1,
      itemsProcessed: 1,
      inputTokens: 600,
      outputTokens: 600,
      success: true,
      durationMs: 1000,
    });

    const mgr = new GraphBudgetManager({ runBudgetTokens: 1000 });
    // Baseline includes the call above; add one more call to exceed delta budget.
    metrics.recordCall({
      timestamp: new Date(),
      module: 'brief-generator',
      model: 'claude-haiku-4-5-20251001',
      batchSize: 1,
      itemsProcessed: 1,
      inputTokens: 600,
      outputTokens: 600,
      success: true,
      durationMs: 1000,
    });

    expect(mgr.canStartNextBrief()).toBe(false);
    expect(mgr.getBlockReason()).toBe('budget_tokens_exceeded');
  });
});

