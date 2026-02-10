/**
 * Generate Phase Runner
 *
 * Creates business briefs from scored problems and gap analyses.
 */

import { generateAllBriefs, validateBriefQuality } from '../../generation/brief-generator';
import type { ScoredProblem } from '../../analysis/scorer';
import type { GapAnalysis } from '../../analysis/gap-analyzer';
import { cosineSimilarity } from '../../analysis/similarity';
import { createPhaseLogger } from '../utils/logger';
import { AnalysisError, wrapError } from '../../lib/errors';
import type {
  PhaseResult,
  GeneratePhaseOutput,
  PipelineConfig,
} from '../types';
import { getPipelineBriefModel } from '../../config/models';
import { db, ideas } from '../../api/db/client';

/** Similarity threshold for post-filter deduplication of scored problems */
const BRIEF_DEDUP_THRESHOLD = 0.85;

/**
 * Deduplicate scored problems by comparing cluster embeddings.
 * Keeps the higher-priority problem when two are too similar.
 * Returns up to `limit` deduplicated problems, backfilling from
 * the remaining pool when duplicates are removed.
 */
function deduplicateByEmbedding(
  problems: ScoredProblem[],
  limit: number,
  threshold: number = BRIEF_DEDUP_THRESHOLD,
): { selected: ScoredProblem[]; removed: number } {
  // Problems are already sorted by priority (descending) from the scorer
  const selected: ScoredProblem[] = [];
  let removed = 0;

  for (const problem of problems) {
    if (selected.length >= limit) break;

    // Skip if embedding is missing
    if (!problem.embedding || problem.embedding.length === 0) {
      selected.push(problem);
      continue;
    }

    // Check similarity against already-selected problems
    const isDuplicate = selected.some((existing) => {
      if (!existing.embedding || existing.embedding.length === 0) return false;
      return cosineSimilarity(problem.embedding, existing.embedding) >= threshold;
    });

    if (isDuplicate) {
      removed++;
    } else {
      selected.push(problem);
    }
  }

  return { selected, removed };
}

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
    // Filter by minimum priority, then deduplicate similar problems
    const eligibleProblems = scoredProblems
      .filter((p) => p.scores.priority >= config.minPriorityScore);

    const { selected: filteredProblems, removed: dedupRemoved } =
      deduplicateByEmbedding(eligibleProblems, config.maxBriefs);

    if (dedupRemoved > 0) {
      logger.info(
        { removed: dedupRemoved, threshold: BRIEF_DEDUP_THRESHOLD },
        'Removed similar problems via embedding deduplication'
      );
    }

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
        const validatedBriefs = briefs.map(brief => {
          const quality = validateBriefQuality(brief);
          if (!quality.valid) {
            logger.warn(
              { briefName: brief.name, reasons: quality.reasons },
              'Brief failed quality validation — will not auto-publish'
            );
          }
          return { brief, quality };
        });

        const publishableBriefs = validatedBriefs.filter(v => v.quality.valid);
        const flaggedBriefs = validatedBriefs.filter(v => !v.quality.valid);

        logger.info(
          { publishable: publishableBriefs.length, flagged: flaggedBriefs.length },
          'Brief quality validation results'
        );

        await db
          .insert(ideas)
          .values(
            validatedBriefs.map(({ brief, quality }) => ({
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
              sources: brief.sources,
              generatedAt: brief.generatedAt,
              isPublished: quality.valid,
              publishedAt: quality.valid ? new Date() : null,
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
