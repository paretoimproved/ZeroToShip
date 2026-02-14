import type { GapAnalysis } from '../../analysis/gap-analyzer';
import logger from '../../lib/logger';
import { GraphBudgetManager } from '../graph/budget';
import { runSingleBriefGraph } from '../graph';
import type { IdeaBrief } from '../brief-generator';
import { LegacyGenerationProvider } from './legacy-provider';
import type { GenerationProvider, GenerationProviderInput } from './types';

async function runInPool<T, R>(
  items: T[],
  maxConcurrent: number,
  canStartNext: () => boolean,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  let active = 0;

  return await new Promise<R[]>((resolve, reject) => {
    const launch = () => {
      while (active < maxConcurrent && nextIndex < items.length && canStartNext()) {
        const item = items[nextIndex++];
        active += 1;
        worker(item)
          .then((res) => {
            results.push(res);
            active -= 1;
            launch();
          })
          .catch((err) => reject(err));
      }

      if ((nextIndex >= items.length || !canStartNext()) && active === 0) {
        resolve(results);
      }
    };

    launch();
  });
}

export class GraphGenerationProvider implements GenerationProvider {
  readonly mode = 'graph' as const;

  private readonly legacyProvider = new LegacyGenerationProvider();

  async generate(input: GenerationProviderInput): Promise<IdeaBrief[]> {
    const cfg = input.config ?? {};
    const maxConcurrent = Math.max(1, cfg.maxConcurrent ?? 2);
    const budget = new GraphBudgetManager({
      runBudgetUsd: cfg.runBudgetUsd,
      runBudgetTokens: cfg.runBudgetTokens,
    });

    const worker = async (problem: (typeof input.scoredProblems)[number]): Promise<IdeaBrief> => {
      const perProblemGaps = new Map<string, GapAnalysis>();
      const gap = input.gapAnalyses.get(problem.id);
      if (gap) perProblemGaps.set(problem.id, gap);

      try {
        const graphResult = await runSingleBriefGraph({
          problem,
          gapAnalyses: perProblemGaps,
          config: cfg,
        });

        logger.info(
          {
            problemId: problem.id,
            attemptsUsed: graphResult.attemptsUsed,
            retried: graphResult.retried,
            passedQuality: graphResult.passedQuality,
            modelsUsed: graphResult.modelsUsed,
            failedSections: graphResult.failedSections,
            reasons: graphResult.reasons,
          },
          'Graph provider generated single brief'
        );

        const retriedSections = Object.entries(graphResult.sectionRetryCounts)
          .filter(([, count]) => count > 0)
          .map(([section]) => section);

        return {
          ...graphResult.brief,
          generationMeta: {
            isFallback: graphResult.brief.generationMeta?.isFallback ?? false,
            fallbackReason: graphResult.brief.generationMeta?.fallbackReason,
            providerMode: 'graph' as const,
            graphAttemptCount: graphResult.attemptsUsed,
            graphModelsUsed: graphResult.modelsUsed,
            graphFailedSections: graphResult.failedSections,
            graphRetriedSections: retriedSections,
            graphTrace: graphResult.trace,
          },
        };
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
          config: cfg,
        });

        const brief = fallbackBriefs[0];
        if (!brief) {
          throw new Error(`Legacy fallback produced no brief for problem "${problem.id}"`);
        }

        return {
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
          },
        };
      }
    };

    const results = await runInPool(
      input.scoredProblems,
      maxConcurrent,
      () => {
        const ok = budget.canStartNextBrief();
        if (!ok) {
          const reason = budget.getBlockReason();
          logger.warn({ reason, spent: budget.getSpent() }, 'Graph run halted due to budget cap');
        }
        return ok;
      },
      worker,
    );

    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results;
  }
}
