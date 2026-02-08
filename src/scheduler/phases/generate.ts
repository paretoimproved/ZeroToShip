/**
 * Generate Phase Runner
 *
 * Creates business briefs from scored problems and gap analyses.
 */

import { generateAllBriefs } from '../../generation/brief-generator';
import type { ScoredProblem } from '../../analysis/scorer';
import type { GapAnalysis } from '../../analysis/gap-analyzer';
import { createPhaseLogger } from '../utils/logger';
import { AnalysisError, wrapError } from '../../lib/errors';
import type {
  PhaseResult,
  GeneratePhaseOutput,
  PipelineConfig,
} from '../types';
import { getPipelineBriefModel } from '../../config/models';
import { db, ideas } from '../../api/db/client';

/**
 * Run the generate phase
 */
export async function runGeneratePhase(
  runId: string,
  config: PipelineConfig,
  scoredProblems: ScoredProblem[],
  gapAnalyses: Map<string, GapAnalysis>,
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
        severity: 'fatal',
        duration: Date.now() - startTime,
        phase: 'generate',
        timestamp: new Date(),
      };
    }

    // Generate briefs with tier-appropriate model
    const briefs = await generateAllBriefs(filteredProblems, gapAnalyses, {
      model: getPipelineBriefModel(),
    });

    // Persist generated briefs to database
    try {
      if (briefs.length > 0) {
        await db
          .insert(ideas)
          .values(
            briefs.map((brief) => ({
              name: brief.name,
              tagline: brief.tagline,
              priorityScore: String(brief.priorityScore),
              effortEstimate: brief.effortEstimate,
              revenueEstimate: brief.revenueEstimate,
              category: brief.keyFeatures?.[0] || null,
              problemStatement: brief.problemStatement,
              targetAudience: brief.targetAudience,
              marketSize: brief.marketSize,
              existingSolutions: brief.existingSolutions,
              gaps: brief.gaps,
              proposedSolution: brief.proposedSolution,
              keyFeatures: brief.keyFeatures,
              mvpScope: brief.mvpScope,
              technicalSpec: brief.technicalSpec,
              businessModel: brief.businessModel,
              goToMarket: brief.goToMarket,
              risks: brief.risks,
              generatedAt: brief.generatedAt,
              isPublished: true,
              publishedAt: new Date(),
            }))
          )
          .onConflictDoNothing();

        logger.info({ count: briefs.length }, 'Persisted briefs to database');
      }
    } catch (dbError) {
      logger.warn(
        { error: dbError instanceof Error ? dbError.message : String(dbError) },
        'Failed to persist briefs to database (non-fatal)'
      );
    }

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
    // Generate phase uses AnalysisError since it's part of the analysis pipeline
    const wrappedError = wrapError(error, AnalysisError, { phase: 'generate' });
    const errorMessage = wrappedError.message;

    logger.error({ error: errorMessage, severity: wrappedError.severity }, 'Generate phase failed');

    return {
      success: false,
      data: null,
      error: errorMessage,
      severity: wrappedError.severity,
      duration,
      phase: 'generate',
      timestamp: new Date(),
    };
  }
}
