/**
 * Problem Scorer for ZeroToShip
 *
 * Scores deduplicated problem clusters on impact and effort
 * to calculate priority for startup opportunity ranking.
 */

import type { ProblemCluster } from './deduplicator';
import { config } from '../config/env';
import logger from '../lib/logger';
import { AnalysisError } from '../lib/errors';
import {
  buildScoringPrompt,
  parseScoreResponse,
  createDefaultScores,
  SCORING_SYSTEM_PROMPT,
  BATCH_SCORING_SYSTEM_PROMPT,
  buildBatchScoringPrompt,
  parseBatchScoreResponse,
  type ScoreResponse,
} from './score-prompts';
import { getBatchModel } from '../config/models';
import { getGlobalMetrics } from '../scheduler/utils/api-metrics';
import { estimateTokens } from '../scheduler/utils/token-estimator';
import { ScoreCache, type ScoreCacheOptions } from './score-cache';

/**
 * Batch size for batch scoring API calls
 * 20 problems per call balances quality and cost efficiency
 */
const BATCH_SIZE = 20;

/** Max tokens for a single problem scoring API call */
const SCORING_MAX_TOKENS = 500;

/** Max tokens for a batch scoring API call */
const BATCH_SCORING_MAX_TOKENS = 4000;

/** Frequency count at which a problem gets the max frequency score (10) */
const FREQUENCY_HIGH_THRESHOLD = 100;

/** Max effort score for "quick wins" filter (complexity * timeToMvp) */
const QUICK_WINS_MAX_EFFORT = 25;

/** Number of top problems to show in stats summaries */
const TOP_N_DISPLAY_LIMIT = 5;

/** Default max concurrent API calls for scoring */
const DEFAULT_MAX_CONCURRENT = 3;

/** Default delay between scoring API calls (ms) */
const DEFAULT_DELAY_BETWEEN_CALLS_MS = 200;

/** Max time-to-MVP score for "weekend project" filter */
const WEEKEND_MAX_TIME_TO_MVP = 2;

/** Max technical complexity for "weekend project" filter */
const WEEKEND_MAX_COMPLEXITY = 4;

/**
 * Score breakdown for a problem
 */
export interface ProblemScores {
  frequency: number;
  severity: number;
  marketSize: number;
  technicalComplexity: number;
  timeToMvp: number;
  engagement: number;
  impact: number;
  effort: number;
  priority: number;
}

/**
 * AI reasoning for each scored dimension
 */
export interface ScoreReasoning {
  severity: string;
  marketSize: string;
  technicalComplexity: string;
}

/**
 * A scored problem cluster with priority ranking
 */
export interface ScoredProblem extends ProblemCluster {
  scores: ProblemScores;
  reasoning: ScoreReasoning;
}

/**
 * Options for the scoring process
 */
export interface ScoringOptions {
  anthropicApiKey?: string;
  model?: string;
  maxConcurrent?: number;
  delayBetweenCalls?: number;
  useAI?: boolean;
  /** Options for the score dedup cache. Set { disabled: true } to skip caching. */
  scoreCacheOptions?: ScoreCacheOptions;
}

const DEFAULT_OPTIONS: Required<ScoringOptions> = {
  anthropicApiKey: '',
  model: getBatchModel(),
  maxConcurrent: DEFAULT_MAX_CONCURRENT,
  delayBetweenCalls: DEFAULT_DELAY_BETWEEN_CALLS_MS,
  useAI: true,
  scoreCacheOptions: {},
};

/**
 * Calculate engagement score from total community engagement and frequency.
 * Uses log-scale normalization to a 1-10 range:
 *   0 avg → 1, 10 avg → ~4.1, 100 avg → ~7, 1000 avg → 10
 */
export function calculateEngagementScore(totalScore: number, frequency: number): number {
  if (frequency <= 0) return 1;
  const avgEngagement = totalScore / frequency;
  const score = Math.log10(avgEngagement + 1) * 3 + 1;
  return Math.max(1, Math.min(10, score));
}

/**
 * Calculate impact score
 * IMPACT = frequency × severity × marketSize × (engagement / 5)
 * Engagement centered at 5 = 1.0x multiplier (neutral).
 * engagement=1 → 0.2x penalty, engagement=10 → 2.0x boost.
 */
function calculateImpact(frequency: number, severity: number, marketSize: number, engagement: number): number {
  return frequency * severity * marketSize * (engagement / 5);
}

/**
 * Calculate effort score
 * EFFORT = technicalComplexity × timeToMvp
 */
function calculateEffort(technicalComplexity: number, timeToMvp: number): number {
  return technicalComplexity * timeToMvp;
}

/**
 * Calculate priority score
 * PRIORITY = IMPACT / EFFORT
 */
function calculatePriority(impact: number, effort: number): number {
  // Avoid division by zero
  if (effort === 0) return impact;
  return impact / effort;
}

/**
 * Normalize raw priority score to 0-100 scale using log10.
 * Calibration: raw 1→0, raw 3.16→20, raw 10→40, raw 31.6→60, raw 100→80, raw 316→96
 */
function normalizePriority(rawPriority: number): number {
  if (rawPriority <= 0) return 0;
  const normalized = Math.round(Math.log10(rawPriority) * 40);
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Anthropic API to score a problem cluster
 */
async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string
): Promise<ScoreResponse | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: SCORING_MAX_TOKENS,
        system: SCORING_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      const analysisErr = new AnalysisError(`Anthropic API error (${response.status})`, {
        severity: 'degraded',
        context: { statusCode: response.status, response: error },
      });
      logger.warn({ err: analysisErr, status: response.status }, 'Anthropic API error');
      return null;
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const content = data.content[0]?.text;
    if (!content) {
      logger.warn('No content in Anthropic response');
      return null;
    }

    return parseScoreResponse(content);
  } catch (error) {
    const analysisErr = new AnalysisError(
      `Anthropic API call failed: ${error instanceof Error ? error.message : String(error)}`,
      { severity: 'degraded', cause: error instanceof Error ? error : undefined }
    );
    logger.warn({ err: analysisErr }, 'Anthropic API call failed');
    return null;
  }
}

/**
 * Call Anthropic API to score multiple problems in a single batch
 * @param clusters - Array of problem clusters to score (max BATCH_SIZE)
 * @param apiKey - Anthropic API key
 * @param model - Model to use for scoring
 * @returns Map of cluster ID to ScoreResponse
 */
async function scoreBatch(
  clusters: ProblemCluster[],
  apiKey: string,
  model: string
): Promise<Map<string, ScoreResponse>> {
  const startTime = Date.now();
  const prompt = buildBatchScoringPrompt(clusters);
  const clusterIds = clusters.map(c => c.id);
  const inputTokens = estimateTokens(BATCH_SCORING_SYSTEM_PROMPT) + estimateTokens(prompt);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: BATCH_SCORING_MAX_TOKENS,
        system: BATCH_SCORING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      const analysisErr = new AnalysisError(`Batch scoring API error (${response.status})`, {
        severity: 'degraded',
        context: { statusCode: response.status, batchSize: clusters.length },
      });
      logger.warn({ err: analysisErr, status: response.status }, 'Batch scoring API error');

      // Record failed call
      getGlobalMetrics().recordCall({
        timestamp: new Date(),
        module: 'scorer',
        model,
        batchSize: clusters.length,
        itemsProcessed: 0,
        inputTokens,
        outputTokens: 0,
        success: false,
        durationMs: Date.now() - startTime,
      });

      return new Map();
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const content = data.content[0]?.text;
    if (!content) {
      logger.warn('No content in batch scoring response');
      return new Map();
    }

    // Record successful call
    getGlobalMetrics().recordCall({
      timestamp: new Date(),
      module: 'scorer',
      model,
      batchSize: clusters.length,
      itemsProcessed: clusters.length,
      inputTokens,
      outputTokens: estimateTokens(content),
      success: true,
      durationMs: Date.now() - startTime,
    });

    return parseBatchScoreResponse(content, clusterIds);
  } catch (error) {
    const analysisErr = new AnalysisError(
      `Batch scoring API call failed: ${error instanceof Error ? error.message : String(error)}`,
      { severity: 'degraded', context: { batchSize: clusters.length }, cause: error instanceof Error ? error : undefined }
    );
    logger.warn({ err: analysisErr }, 'Batch scoring API call failed');

    // Record failed call
    getGlobalMetrics().recordCall({
      timestamp: new Date(),
      module: 'scorer',
      model,
      batchSize: clusters.length,
      itemsProcessed: 0,
      inputTokens,
      outputTokens: 0,
      success: false,
      durationMs: Date.now() - startTime,
    });

    return new Map();
  }
}

/**
 * Calculate frequency score (normalized 1-10)
 */
function calculateFrequencyScore(frequency: number): number {
  // Log scale normalization:
  // 1 mention = 1, 3 mentions = 3, 10 mentions = 5, 30 mentions = 7, 100+ = 10
  if (frequency <= 1) return 1;
  if (frequency >= FREQUENCY_HIGH_THRESHOLD) return 10;
  return Math.min(10, Math.max(1, Math.ceil(Math.log10(frequency) * 4 + 1)));
}

/**
 * Score a single problem cluster using AI
 */
export async function scoreProblem(
  cluster: ProblemCluster,
  options: ScoringOptions = {}
): Promise<ScoredProblem> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const apiKey = opts.anthropicApiKey || config.ANTHROPIC_API_KEY;

  // Calculate frequency score from cluster data
  const frequencyScore = calculateFrequencyScore(cluster.frequency);

  let aiScores: ScoreResponse;

  if (opts.useAI && apiKey) {
    const prompt = buildScoringPrompt(cluster);
    const response = await callAnthropic(prompt, apiKey, opts.model);
    aiScores = response || createDefaultScores(cluster);
  } else {
    aiScores = createDefaultScores(cluster);
  }

  // Calculate composite scores
  const engagementScore = calculateEngagementScore(cluster.totalScore, cluster.frequency);

  const impact = calculateImpact(
    frequencyScore,
    aiScores.severity.score,
    aiScores.marketSize.score,
    engagementScore
  );

  const effort = calculateEffort(
    aiScores.technicalComplexity.score,
    aiScores.timeToMvp.score
  );

  const priority = normalizePriority(calculatePriority(impact, effort));

  return {
    ...cluster,
    scores: {
      frequency: frequencyScore,
      severity: aiScores.severity.score,
      marketSize: aiScores.marketSize.score,
      technicalComplexity: aiScores.technicalComplexity.score,
      timeToMvp: aiScores.timeToMvp.score,
      engagement: engagementScore,
      impact,
      effort,
      priority,
    },
    reasoning: {
      severity: aiScores.severity.reasoning,
      marketSize: aiScores.marketSize.reasoning,
      technicalComplexity: aiScores.technicalComplexity.reasoning,
    },
  };
}

/**
 * Score all problem clusters using batch API calls.
 * Checks a local score cache first — clusters scored within the TTL
 * (default 48h) are reused without calling the Anthropic API.
 * Batches BATCH_SIZE problems per API call to reduce costs by ~95%.
 */
export async function scoreAll(
  clusters: ProblemCluster[],
  options: ScoringOptions = {}
): Promise<ScoredProblem[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const apiKey = opts.anthropicApiKey || config.ANTHROPIC_API_KEY;

  if (clusters.length === 0) return [];

  // Initialize score cache for dedup
  const cache = new ScoreCache(opts.scoreCacheOptions);

  // Separate cached vs. uncached clusters
  const cachedResults: ScoredProblem[] = [];
  const uncachedClusters: ProblemCluster[] = [];

  for (const cluster of clusters) {
    const cached = cache.get(cluster.representativePost.url, cluster.problemStatement);
    if (cached) {
      cachedResults.push(cached);
    } else {
      uncachedClusters.push(cluster);
    }
  }

  if (cachedResults.length > 0) {
    logger.info(
      { cached: cachedResults.length, uncached: uncachedClusters.length, total: clusters.length },
      'Score cache hit — reusing recent scores'
    );
  }

  const results: ScoredProblem[] = [...cachedResults];

  // Only score uncached clusters
  if (uncachedClusters.length > 0) {
    const numBatches = Math.ceil(uncachedClusters.length / BATCH_SIZE);
    logger.info({ problems: uncachedClusters.length, batches: numBatches }, 'Batch scoring problems');

    for (let i = 0; i < uncachedClusters.length; i += BATCH_SIZE) {
      const batch = uncachedClusters.slice(i, i + BATCH_SIZE);
      let batchScores: Map<string, ScoreResponse>;

      // Try batch scoring with AI if enabled
      if (opts.useAI && apiKey) {
        batchScores = await scoreBatch(batch, apiKey, opts.model);
      } else {
        batchScores = new Map();
      }

      // Convert batch results to ScoredProblems
      for (const cluster of batch) {
        // Use AI score if available, otherwise fall back to defaults
        const aiScores = batchScores.get(cluster.id) || createDefaultScores(cluster);
        const frequencyScore = calculateFrequencyScore(cluster.frequency);
        const engagementScore = calculateEngagementScore(cluster.totalScore, cluster.frequency);

        const impact = calculateImpact(
          frequencyScore,
          aiScores.severity.score,
          aiScores.marketSize.score,
          engagementScore
        );

        const effort = calculateEffort(
          aiScores.technicalComplexity.score,
          aiScores.timeToMvp.score
        );

        const priority = normalizePriority(calculatePriority(impact, effort));

        const scored: ScoredProblem = {
          ...cluster,
          scores: {
            frequency: frequencyScore,
            severity: aiScores.severity.score,
            marketSize: aiScores.marketSize.score,
            technicalComplexity: aiScores.technicalComplexity.score,
            timeToMvp: aiScores.timeToMvp.score,
            engagement: engagementScore,
            impact,
            effort,
            priority,
          },
          reasoning: {
            severity: aiScores.severity.reasoning,
            marketSize: aiScores.marketSize.reasoning,
            technicalComplexity: aiScores.technicalComplexity.reasoning,
          },
        };

        results.push(scored);
        cache.set(scored);
      }

      // Progress update
      const completed = Math.min(i + BATCH_SIZE, uncachedClusters.length);
      logger.info({ completed, total: uncachedClusters.length }, 'Scoring progress');

      // Rate limiting delay between batches
      if (i + BATCH_SIZE < uncachedClusters.length && opts.delayBetweenCalls > 0) {
        await sleep(opts.delayBetweenCalls);
      }
    }

    // Persist cache after scoring new items
    cache.save();
  }

  // Sort by priority (highest first)
  results.sort((a, b) => b.scores.priority - a.scores.priority);

  logger.info({ topPriority: results[0]?.scores.priority.toFixed(2) || 'N/A' }, 'Scoring complete');

  return results;
}

/**
 * Get summary statistics for scored problems
 */
export function getScoringStats(problems: ScoredProblem[]): {
  count: number;
  avgPriority: number;
  avgImpact: number;
  avgEffort: number;
  topByPriority: Array<{ statement: string; priority: number }>;
  topByImpact: Array<{ statement: string; impact: number }>;
  quickWins: Array<{ statement: string; priority: number; effort: number }>;
} {
  if (problems.length === 0) {
    return {
      count: 0,
      avgPriority: 0,
      avgImpact: 0,
      avgEffort: 0,
      topByPriority: [],
      topByImpact: [],
      quickWins: [],
    };
  }

  const avgPriority = problems.reduce((sum, p) => sum + p.scores.priority, 0) / problems.length;
  const avgImpact = problems.reduce((sum, p) => sum + p.scores.impact, 0) / problems.length;
  const avgEffort = problems.reduce((sum, p) => sum + p.scores.effort, 0) / problems.length;

  // Top 5 by priority
  const topByPriority = [...problems]
    .sort((a, b) => b.scores.priority - a.scores.priority)
    .slice(0, TOP_N_DISPLAY_LIMIT)
    .map(p => ({ statement: p.problemStatement, priority: p.scores.priority }));

  // Top 5 by impact
  const topByImpact = [...problems]
    .sort((a, b) => b.scores.impact - a.scores.impact)
    .slice(0, TOP_N_DISPLAY_LIMIT)
    .map(p => ({ statement: p.problemStatement, impact: p.scores.impact }));

  // Quick wins: high priority + low effort
  const quickWins = [...problems]
    .filter(p => p.scores.effort <= QUICK_WINS_MAX_EFFORT)
    .sort((a, b) => b.scores.priority - a.scores.priority)
    .slice(0, TOP_N_DISPLAY_LIMIT)
    .map(p => ({
      statement: p.problemStatement,
      priority: p.scores.priority,
      effort: p.scores.effort,
    }));

  return {
    count: problems.length,
    avgPriority,
    avgImpact,
    avgEffort,
    topByPriority,
    topByImpact,
    quickWins,
  };
}

/**
 * Export scored problems to JSON format
 */
export function exportScoredProblems(problems: ScoredProblem[]): string {
  return JSON.stringify(
    problems.map(p => ({
      id: p.id,
      problemStatement: p.problemStatement,
      frequency: p.frequency,
      sources: p.sources,
      scores: p.scores,
      reasoning: p.reasoning,
      representativePost: {
        source: p.representativePost.source,
        title: p.representativePost.title,
        url: p.representativePost.url,
      },
    })),
    null,
    2
  );
}

/**
 * Filter problems by minimum priority threshold
 */
export function filterByPriority(
  problems: ScoredProblem[],
  minPriority: number
): ScoredProblem[] {
  return problems.filter(p => p.scores.priority >= minPriority);
}

/**
 * Filter problems by effort level
 */
export function filterByEffort(
  problems: ScoredProblem[],
  maxEffort: number
): ScoredProblem[] {
  return problems.filter(p => p.scores.effort <= maxEffort);
}

/**
 * Get problems suitable for a weekend hackathon
 * (low effort, decent priority)
 */
export function getWeekendProjects(problems: ScoredProblem[]): ScoredProblem[] {
  return problems
    .filter(p => p.scores.timeToMvp <= WEEKEND_MAX_TIME_TO_MVP && p.scores.technicalComplexity <= WEEKEND_MAX_COMPLEXITY)
    .sort((a, b) => b.scores.priority - a.scores.priority);
}
