/**
 * Generate Phase Runner
 *
 * Creates business briefs from scored problems and gap analyses.
 */

import { generateAllBriefs } from '../../generation/brief-generator';
import type { ScoredProblem } from '../../analysis/scorer';
import type { GapAnalysis } from '../../analysis/gap-analyzer';
import { createPhaseLogger } from '../utils/logger';
import type {
  PhaseResult,
  GeneratePhaseOutput,
  PipelineConfig,
} from '../types';

/**
 * Run the generate phase
 */
export async function runGeneratePhase(
  runId: string,
  config: PipelineConfig,
  scoredProblems: ScoredProblem[],
  gapAnalyses: Map<string, GapAnalysis>
): Promise<PhaseResult<GeneratePhaseOutput>> {
  const logger = createPhaseLogger(runId, 'generate');
  const startTime = Date.now();

  logger.info(
    { problemCount: scoredProblems.length, maxBriefs: config.maxBriefs },
    'Starting generate phase'
  );

  try {
    // Filter by minimum priority and limit count
    const filteredProblems = scoredProblems
      .filter((p) => p.scores.priority >= config.minPriorityScore)
      .slice(0, config.maxBriefs);

    logger.debug(
      { filteredCount: filteredProblems.length },
      'Filtered problems for brief generation'
    );

    if (filteredProblems.length === 0) {
      return {
        success: false,
        data: null,
        error: 'No problems met the minimum priority threshold',
        duration: Date.now() - startTime,
        phase: 'generate',
        timestamp: new Date(),
      };
    }

    // Generate briefs
    const briefs = await generateAllBriefs(filteredProblems, gapAnalyses);

    const duration = Date.now() - startTime;

    logger.info(
      { briefCount: briefs.length, duration },
      'Generate phase complete'
    );

    return {
      success: true,
      data: {
        briefCount: briefs.length,
        briefs,
      },
      duration,
      phase: 'generate',
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.error({ error: errorMessage }, 'Generate phase failed');

    return {
      success: false,
      data: null,
      error: errorMessage,
      duration,
      phase: 'generate',
      timestamp: new Date(),
    };
  }
}
