/**
 * Analyze Phase Runner
 *
 * Clusters posts, scores them, then runs gap analysis on top candidates.
 */

import { clusterPosts } from '../../analysis/deduplicator';
import { scoreAll } from '../../analysis/scorer';
import { analyzeAllGaps } from '../../analysis/gap-analyzer';
import type { ProblemCluster, ScoredProblem } from '../../analysis';
import type { RawPost } from '../../scrapers/types';
import { createPhaseLogger } from '../utils/logger';
import { AnalysisError, wrapError } from '../../lib/errors';
import type {
  PhaseResult,
  AnalyzePhaseOutput,
  PipelineConfig,
} from '../types';

/** Analyze this many top-ranked clusters per requested brief */
const GAP_ANALYSIS_BRIEF_BUFFER = 5;

/** Minimum gap-analysis candidate pool for stable quality */
const GAP_ANALYSIS_MIN_CANDIDATES = 15;

/**
 * Select top-ranked clusters for gap analysis to cap search volume.
 */
function selectGapAnalysisCandidates(
  clusters: ProblemCluster[],
  scoredProblems: ScoredProblem[],
  maxBriefs: number
): ProblemCluster[] {
  const candidateLimit = Math.min(
    clusters.length,
    Math.max(maxBriefs * GAP_ANALYSIS_BRIEF_BUFFER, GAP_ANALYSIS_MIN_CANDIDATES)
  );

  if (candidateLimit === clusters.length) {
    return clusters;
  }

  const clusterById = new Map(clusters.map(cluster => [cluster.id, cluster]));
  const selected: ProblemCluster[] = [];
  const selectedIds = new Set<string>();

  for (const problem of scoredProblems) {
    if (selected.length >= candidateLimit) break;
    const cluster = clusterById.get(problem.id);
    if (!cluster) continue;
    selected.push(cluster);
    selectedIds.add(cluster.id);
  }

  if (selected.length < candidateLimit) {
    for (const cluster of clusters) {
      if (selected.length >= candidateLimit) break;
      if (selectedIds.has(cluster.id)) continue;
      selected.push(cluster);
      selectedIds.add(cluster.id);
    }
  }

  return selected;
}

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
        severity: 'fatal',
        duration: Date.now() - startTime,
        phase: 'analyze',
        timestamp: new Date(),
      };
    }

    // Step 2: Score clusters
    logger.debug('Scoring clusters...');
    const scoredProblems = await scoreAll(clusters);

    // Step 3: Analyze only top-ranked clusters to reduce web-search volume
    const gapCandidates = selectGapAnalysisCandidates(
      clusters,
      scoredProblems,
      config.maxBriefs
    );
    logger.info(
      {
        totalClusters: clusters.length,
        scoredCount: scoredProblems.length,
        gapCandidates: gapCandidates.length,
        maxBriefs: config.maxBriefs,
      },
      'Selected clusters for gap analysis'
    );

    const gapAnalyses = await analyzeAllGaps(gapCandidates, {
      minFrequencyForSearch: config.minFrequencyForGap,
    });

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
    const analysisError = wrapError(error, AnalysisError);
    const errorMessage = analysisError.message;

    logger.error({ error: errorMessage, severity: analysisError.severity }, 'Analyze phase failed');

    return {
      success: false,
      data: null,
      error: errorMessage,
      severity: analysisError.severity,
      duration,
      phase: 'analyze',
      timestamp: new Date(),
    };
  }
}
