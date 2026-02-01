/**
 * Analyze Phase Runner
 *
 * Clusters posts, then runs scoring and gap analysis in parallel.
 */

import { clusterPosts } from '../../analysis/deduplicator';
import { scoreAll } from '../../analysis/scorer';
import { analyzeAllGaps } from '../../analysis/gap-analyzer';
import type { RawPost } from '../../scrapers/types';
import { createPhaseLogger } from '../utils/logger';
import type {
  PhaseResult,
  AnalyzePhaseOutput,
  PipelineConfig,
} from '../types';

/**
 * Run the analyze phase
 */
export async function runAnalyzePhase(
  runId: string,
  config: PipelineConfig,
  posts: RawPost[]
): Promise<PhaseResult<AnalyzePhaseOutput>> {
  const logger = createPhaseLogger(runId, 'analyze');
  const startTime = Date.now();

  logger.info({ postCount: posts.length }, 'Starting analyze phase');

  try {
    // Step 1: Cluster posts
    logger.debug('Clustering posts...');
    const clusters = await clusterPosts(posts, {
      similarityThreshold: config.clusteringThreshold,
      generateSummaries: true,
    });

    logger.info({ clusterCount: clusters.length }, 'Clustering complete');

    if (clusters.length === 0) {
      return {
        success: false,
        data: null,
        error: 'No clusters generated from posts',
        duration: Date.now() - startTime,
        phase: 'analyze',
        timestamp: new Date(),
      };
    }

    // Step 2: Score and gap analyze in parallel
    logger.debug('Running scoring and gap analysis in parallel...');
    const [scoredProblems, gapAnalyses] = await Promise.all([
      scoreAll(clusters),
      analyzeAllGaps(clusters, {
        minFrequencyForSearch: config.minFrequencyForGap,
      }),
    ]);

    // Convert gap analyses to Map
    const gapMap = new Map<string, (typeof gapAnalyses)[number]>();
    for (const gap of gapAnalyses) {
      gapMap.set(gap.problemId, gap);
    }

    const duration = Date.now() - startTime;

    logger.info(
      {
        clusterCount: clusters.length,
        scoredCount: scoredProblems.length,
        gapCount: gapAnalyses.length,
        duration,
      },
      'Analyze phase complete'
    );

    return {
      success: true,
      data: {
        clusterCount: clusters.length,
        scoredCount: scoredProblems.length,
        gapAnalysisCount: gapAnalyses.length,
        clusters,
        scoredProblems,
        gapAnalyses: gapMap,
      },
      duration,
      phase: 'analyze',
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.error({ error: errorMessage }, 'Analyze phase failed');

    return {
      success: false,
      data: null,
      error: errorMessage,
      duration,
      phase: 'analyze',
      timestamp: new Date(),
    };
  }
}
