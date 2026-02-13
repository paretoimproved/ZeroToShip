import type { GapAnalysis } from '../../analysis/gap-analyzer';
import type { ScoredProblem } from '../../analysis/scorer';
import type { BriefGeneratorConfig, IdeaBrief } from '../brief-generator';

export type GraphSection =
  | 'core'
  | 'problem'
  | 'audience'
  | 'market'
  | 'solution'
  | 'features'
  | 'technical'
  | 'business_model'
  | 'gtm'
  | 'risks';

export interface GraphRunConfig extends BriefGeneratorConfig {
  maxAttempts?: number;
}

export interface GraphCriticAssessment {
  valid: boolean;
  reasons: string[];
  failedSections: GraphSection[];
}

export interface SingleBriefGraphState {
  problem: ScoredProblem;
  gapAnalyses: Map<string, GapAnalysis>;
  config: GraphRunConfig;
  modelCascade: string[];
  attempt: number;
  maxAttempts: number;
  modelsUsed: string[];
  latestBrief: IdeaBrief | null;
  latestValidation: GraphCriticAssessment | null;
  failedSections: GraphSection[];
  sectionRetryCounts: Record<GraphSection, number>;
}

export interface SingleBriefGraphResult {
  brief: IdeaBrief;
  attemptsUsed: number;
  retried: boolean;
  passedQuality: boolean;
  modelsUsed: string[];
  failedSections: GraphSection[];
  sectionRetryCounts: Record<GraphSection, number>;
  reasons: string[];
}
