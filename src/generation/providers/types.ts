import type { GapAnalysis } from '../../analysis/gap-analyzer';
import type { ScoredProblem } from '../../analysis/scorer';
import type { BriefGeneratorConfig, IdeaBrief } from '../brief-generator';

export type GenerationProviderMode = 'legacy' | 'graph';

export interface GenerationProviderInput {
  scoredProblems: ScoredProblem[];
  gapAnalyses: Map<string, GapAnalysis>;
  config?: BriefGeneratorConfig;
}

export interface GenerationProvider {
  readonly mode: GenerationProviderMode;
  generate(input: GenerationProviderInput): Promise<IdeaBrief[]>;
}

export interface SelectedGenerationProvider {
  requestedMode: GenerationProviderMode;
  effectiveMode: GenerationProviderMode;
  provider: GenerationProvider;
}
