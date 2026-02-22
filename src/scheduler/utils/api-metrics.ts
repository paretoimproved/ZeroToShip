/**
 * API Metrics Collector for ZeroToShip
 *
 * Tracks API call patterns, token usage, and costs for validation
 * of cost optimization targets.
 */

import { MODEL_PRICING, type ClaudeModel } from '../../config/models';

/**
 * Record of a single API call
 */
export interface ApiCallRecord {
  timestamp: Date;
  module: 'scorer' | 'deduplicator' | 'competitor' | 'brief-generator' | 'spec-generation';
  model: string;
  batchSize: number;
  itemsProcessed: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  durationMs: number;
}

/**
 * Summary of API metrics for a pipeline run
 */
export interface ApiMetricsSummary {
  totalCalls: number;
  callsByModule: Record<string, number>;
  callsByModel: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  avgBatchSize: number;
}

/**
 * Collector for API call metrics
 */
export class ApiMetricsCollector {
  private calls: ApiCallRecord[] = [];

  /**
   * Record a single API call
   */
  recordCall(record: ApiCallRecord): void {
    this.calls.push(record);
  }

  /**
   * Get all recorded calls
   */
  getCalls(): ApiCallRecord[] {
    return [...this.calls];
  }

  /**
   * Get summary of all recorded metrics
   */
  getSummary(): ApiMetricsSummary {
    const callsByModule: Record<string, number> = {};
    const callsByModel: Record<string, number> = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalBatchSize = 0;

    for (const call of this.calls) {
      callsByModule[call.module] = (callsByModule[call.module] || 0) + 1;
      callsByModel[call.model] = (callsByModel[call.model] || 0) + 1;
      totalInputTokens += call.inputTokens;
      totalOutputTokens += call.outputTokens;
      totalBatchSize += call.batchSize;
    }

    return {
      totalCalls: this.calls.length,
      callsByModule,
      callsByModel,
      totalInputTokens,
      totalOutputTokens,
      estimatedCost: this.getEstimatedCost(),
      avgBatchSize: this.calls.length > 0 ? totalBatchSize / this.calls.length : 0,
    };
  }

  /**
   * Calculate estimated cost from recorded calls
   */
  getEstimatedCost(): number {
    let cost = 0;
    for (const call of this.calls) {
      // Only count successful calls; failures may not be billed and are often retries/timeouts.
      if (!call.success) continue;
      const pricing = MODEL_PRICING[call.model as ClaudeModel];
      if (pricing) {
        cost += (call.inputTokens / 1_000_000) * pricing.input;
        cost += (call.outputTokens / 1_000_000) * pricing.output;
      }
    }
    return cost;
  }

  /**
   * Reset all recorded metrics
   */
  reset(): void {
    this.calls = [];
  }
}

// Singleton for global metrics collection
let globalCollector: ApiMetricsCollector | null = null;

/**
 * Get the global metrics collector instance
 */
export function getGlobalMetrics(): ApiMetricsCollector {
  if (!globalCollector) {
    globalCollector = new ApiMetricsCollector();
  }
  return globalCollector;
}

/**
 * Reset the global metrics collector
 */
export function resetGlobalMetrics(): void {
  globalCollector = new ApiMetricsCollector();
}
