import { MODEL_PRICING, type ClaudeModel } from '../../config/models';
import { getGlobalMetrics, type ApiCallRecord } from '../../scheduler/utils/api-metrics';

export type GraphBudgetReason =
  | 'budget_usd_exceeded'
  | 'budget_tokens_exceeded';

export interface GraphRunBudgets {
  /** Cap only applies to `module === "brief-generator"` calls. */
  runBudgetUsd?: number;
  /** Cap only applies to `module === "brief-generator"` calls. */
  runBudgetTokens?: number;
}

export interface GraphBudgetSnapshot {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

function computeSnapshot(calls: ApiCallRecord[]): GraphBudgetSnapshot {
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;

  for (const call of calls) {
    inputTokens += call.inputTokens;
    outputTokens += call.outputTokens;

    // Match run-level estimatedCost semantics: only count successful calls.
    if (!call.success) continue;
    const pricing = MODEL_PRICING[call.model as ClaudeModel];
    if (!pricing) continue;
    estimatedCostUsd += (call.inputTokens / 1_000_000) * pricing.input;
    estimatedCostUsd += (call.outputTokens / 1_000_000) * pricing.output;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd,
  };
}

function getBriefGeneratorCalls(): ApiCallRecord[] {
  return getGlobalMetrics().getCalls().filter((c) => c.module === 'brief-generator');
}

export class GraphBudgetManager {
  private readonly budgets: GraphRunBudgets;
  private readonly baseline: GraphBudgetSnapshot;

  constructor(budgets: GraphRunBudgets) {
    this.budgets = budgets;
    this.baseline = computeSnapshot(getBriefGeneratorCalls());
  }

  getSpent(): GraphBudgetSnapshot {
    const current = computeSnapshot(getBriefGeneratorCalls());
    return {
      inputTokens: Math.max(0, current.inputTokens - this.baseline.inputTokens),
      outputTokens: Math.max(0, current.outputTokens - this.baseline.outputTokens),
      totalTokens: Math.max(0, current.totalTokens - this.baseline.totalTokens),
      estimatedCostUsd: Math.max(0, current.estimatedCostUsd - this.baseline.estimatedCostUsd),
    };
  }

  getBlockReason(): GraphBudgetReason | null {
    const spent = this.getSpent();

    if (typeof this.budgets.runBudgetUsd === 'number' && this.budgets.runBudgetUsd >= 0) {
      if (spent.estimatedCostUsd >= this.budgets.runBudgetUsd) {
        return 'budget_usd_exceeded';
      }
    }

    if (typeof this.budgets.runBudgetTokens === 'number' && this.budgets.runBudgetTokens >= 0) {
      if (spent.totalTokens >= this.budgets.runBudgetTokens) {
        return 'budget_tokens_exceeded';
      }
    }

    return null;
  }

  canStartNextBrief(): boolean {
    return this.getBlockReason() === null;
  }
}

