import type { GapAnalysis } from '../../analysis/gap-analyzer';
import type { ScoredProblem } from '../../analysis/scorer';
import type { BriefGeneratorConfig, IdeaBrief } from '../brief-generator';

export interface GraphRunConfig extends BriefGeneratorConfig {
  maxAttempts?: number;
}

export interface SingleBriefGraphState {
  problem: ScoredProblem;
  gapAnalyses: Map<string, GapAnalysis>;
  config: GraphRunConfig;
  attempt: number;
  maxAttempts: number;
  latestBrief: IdeaBrief | null;
  latestValidation: {
    valid: boolean;
    reasons: string[];
  } | null;
}

export interface SingleBriefGraphResult {
  brief: IdeaBrief;
  attemptsUsed: number;
  retried: boolean;
  passedQuality: boolean;
}
