import type { GapAnalysis } from '../../analysis/gap-analyzer';
import logger from '../../lib/logger';
import { runSingleBriefGraph } from '../graph';
import type { IdeaBrief } from '../brief-generator';
import { LegacyGenerationProvider } from './legacy-provider';
import type { GenerationProvider, GenerationProviderInput } from './types';

export class GraphGenerationProvider implements GenerationProvider {
  readonly mode = 'graph' as const;

  private readonly legacyProvider = new LegacyGenerationProvider();

  async generate(input: GenerationProviderInput): Promise<IdeaBrief[]> {
    const results: IdeaBrief[] = [];

    for (const problem of input.scoredProblems) {
      const perProblemGaps = new Map<string, GapAnalysis>();
      const gap = input.gapAnalyses.get(problem.id);
      if (gap) {
        perProblemGaps.set(problem.id, gap);
      }

      try {
        const graphResult = await runSingleBriefGraph({
          problem,
          gapAnalyses: perProblemGaps,
          config: input.config ?? {},
        });

        logger.info(
          {
            problemId: problem.id,
            attemptsUsed: graphResult.attemptsUsed,
            retried: graphResult.retried,
            passedQuality: graphResult.passedQuality,
          },
          'Graph provider generated single brief'
        );

        results.push(graphResult.brief);
      } catch (error) {
        logger.warn(
          {
            problemId: problem.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Graph provider failed for problem; falling back to legacy provider'
        );

        const fallbackBriefs = await this.legacyProvider.generate({
          scoredProblems: [problem],
          gapAnalyses: perProblemGaps,
          config: input.config,
        });

        results.push(...fallbackBriefs);
      }
    }

    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results;
  }
}
