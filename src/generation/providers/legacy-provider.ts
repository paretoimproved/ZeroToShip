import { generateAllBriefs } from '../brief-generator';
import type { GenerationProvider, GenerationProviderInput } from './types';

export class LegacyGenerationProvider implements GenerationProvider {
  readonly mode = 'legacy' as const;

  async generate(input: GenerationProviderInput) {
    const briefs = await generateAllBriefs(input.scoredProblems, input.gapAnalyses, input.config);
    return briefs.map((brief) => ({
      ...brief,
      generationMeta: {
        isFallback: brief.generationMeta?.isFallback ?? false,
        fallbackReason: brief.generationMeta?.fallbackReason,
        providerMode: 'legacy' as const,
        graphAttemptCount: brief.generationMeta?.graphAttemptCount,
        graphModelsUsed: brief.generationMeta?.graphModelsUsed,
        graphFailedSections: brief.generationMeta?.graphFailedSections,
        graphRetriedSections: brief.generationMeta?.graphRetriedSections,
        graphTrace: brief.generationMeta?.graphTrace,
        handoffMeta: brief.generationMeta?.handoffMeta,
      },
    }));
  }
}
