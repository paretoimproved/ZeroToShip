import { generateAllBriefs } from '../brief-generator';
import type { GenerationProvider, GenerationProviderInput } from './types';

export class LegacyGenerationProvider implements GenerationProvider {
  readonly mode = 'legacy' as const;

  async generate(input: GenerationProviderInput) {
    return generateAllBriefs(input.scoredProblems, input.gapAnalyses, input.config);
  }
}
