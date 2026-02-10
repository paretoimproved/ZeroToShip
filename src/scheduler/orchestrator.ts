/**
 * Pipeline Orchestrator
 *
 * Coordinates the execution of all pipeline phases in sequence.
 */

import * as crypto from 'crypto';
import { createRunLogger } from './utils/logger';
import { MetricsCollector } from './utils/metrics';
import { getGlobalMetrics, resetGlobalMetrics } from './utils/api-metrics';
import { runScrapePhase } from './phases/scrape';
import { runAnalyzePhase } from './phases/analyze';
import { runGeneratePhase } from './phases/generate';
import { runDeliverPhase } from './phases/deliver';
import { isZeroToShipError, isFatalError } from '../lib/errors';
import { initMonitoring, captureException } from '../lib/monitoring';
import { sendPipelineFailureAlert } from '../lib/alerts';
import {
  initRunStatus,
  savePhaseResult,
  updatePhaseStatus,
  updatePhaseStats,
  loadRunStatus,
  loadPhaseResult,
  getResumePhase,
} from './utils/persistence';
import { db, pipelineRuns } from '../api/db/client';
import { DEFAULT_SIMILARITY_THRESHOLD } from '../analysis/similarity';
import type {
  PipelineConfig,
  PipelineResult,
  PhaseResult,
  PhaseName,
  ScrapePhaseOutput,
  AnalyzePhaseOutput,
  GeneratePhaseOutput,
  DeliverPhaseOutput,
  PipelineError,
} from './types';

/** Default scrape lookback window (hours) */
const DEFAULT_HOURS_BACK = 48;

/** Minimum post frequency for gap analysis to be worth running */
const DEFAULT_MIN_FREQUENCY_FOR_GAP = 2;

/** Maximum number of briefs to generate per pipeline run */
const DEFAULT_MAX_BRIEFS = 10;

/** Minimum priority score for a problem to be included in brief generation */
const DEFAULT_MIN_PRIORITY_SCORE = 5;

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  hoursBack: DEFAULT_HOURS_BACK,
  scrapers: {
    reddit: true,
    hn: true,
    twitter: true,
    github: true,
  },
  clusteringThreshold: DEFAULT_SIMILARITY_THRESHOLD,
  minFrequencyForGap: DEFAULT_MIN_FREQUENCY_FOR_GAP,
  maxBriefs: DEFAULT_MAX_BRIEFS,
  minPriorityScore: DEFAULT_MIN_PRIORITY_SCORE,
  dryRun: false,
  verbose: false,
};

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const rand = crypto.randomBytes(4).toString('hex');
  return `run_${date}_${rand}`;
}

/**
 * Build the final pipeline result
 */
function buildResult(
  runId: string,
  startedAt: Date,
  config: PipelineConfig,
  phases: {
    scrape?: PhaseResult<ScrapePhaseOutput>;
    analyze?: PhaseResult<AnalyzePhaseOutput>;
    generate?: PhaseResult<GeneratePhaseOutput>;
    deliver?: PhaseResult<DeliverPhaseOutput>;
  },
  errors: PipelineError[]
): PipelineResult {
  const completedAt = new Date();

  // Create empty phase results for missing phases
  const emptyPhaseResult = <T>(phase: string): PhaseResult<T> => ({
    success: false,
    data: null,
    error: 'Phase not executed',
    duration: 0,
    phase: phase as PhaseResult<T>['phase'],
    timestamp: new Date(),
  });

  const scrape = phases.scrape || emptyPhaseResult<ScrapePhaseOutput>('scrape');
  const analyze = phases.analyze || emptyPhaseResult<AnalyzePhaseOutput>('analyze');
  const generate = phases.generate || emptyPhaseResult<GeneratePhaseOutput>('generate');
  const deliver = phases.deliver || emptyPhaseResult<DeliverPhaseOutput>('deliver');

  return {
    runId,
    startedAt,
    completedAt,
    config,
    phases: { scrape, analyze, generate, deliver },
    stats: {
      postsScraped: scrape.data?.totalPosts || 0,
      clustersCreated: analyze.data?.clusterCount || 0,
      ideasGenerated: generate.data?.briefCount || 0,
      emailsSent: deliver.data?.sent || 0,
    },
    success: deliver.success,
    totalDuration: completedAt.getTime() - startedAt.getTime(),
    errors,
  };
}

/**
 * Check if a phase should be skipped during a resumed run.
 * A phase is skipped if it already completed in the previous run
 * and falls before the resume point.
 */
function shouldSkipPhase(
  resumePhase: PhaseName | null,
  currentPhase: PhaseName
): boolean {
  if (!resumePhase) return false;
  const order: PhaseName[] = ['scrape', 'analyze', 'generate', 'deliver'];
  return order.indexOf(currentPhase) < order.indexOf(resumePhase);
}

/**
 * Run the complete ZeroToShip pipeline
 *
 * Supports resuming from a previous failed run via `config.resumeRunId`.
 * When resuming, completed phase results are loaded from disk and the
 * pipeline picks up from the first incomplete phase.
 */
export async function runPipeline(
  config: Partial<PipelineConfig> = {},
  preGeneratedRunId?: string
): Promise<PipelineResult> {
  const fullConfig = { ...DEFAULT_PIPELINE_CONFIG, ...config };

  // Determine run ID and resume state
  let runId: string;
  let resumePhase: PhaseName | null = null;

  if (fullConfig.resumeRunId) {
    const previousStatus = loadRunStatus(fullConfig.resumeRunId);
    if (!previousStatus) {
      throw new Error(
        `Cannot resume run "${fullConfig.resumeRunId}": status file not found or corrupted`
      );
    }
    runId = fullConfig.resumeRunId;
    resumePhase = getResumePhase(previousStatus);
    if (!resumePhase) {
      throw new Error(
        `Cannot resume run "${runId}": all phases already completed`
      );
    }
  } else {
    runId = preGeneratedRunId || generateRunId();
  }

  const logger = createRunLogger(runId);
  const metrics = new MetricsCollector(runId);
  const errors: PipelineError[] = [];

  // Reset API metrics at start
  resetGlobalMetrics();

  const startedAt = new Date();

  // Initialize monitoring
  initMonitoring();

  if (resumePhase) {
    logger.info(
      { config: fullConfig, resumePhase },
      'Pipeline resuming from previous run'
    );
  } else {
    logger.info({ config: fullConfig }, 'Pipeline started');
    initRunStatus(runId, fullConfig);
  }

  // Phase 1: Scrape
  let scrapeResult: PhaseResult<ScrapePhaseOutput>;

  if (shouldSkipPhase(resumePhase, 'scrape')) {
    const cached = loadPhaseResult<ScrapePhaseOutput>(runId, 'scrape');
    if (!cached) {
      throw new Error(`Resume failed: could not load persisted scrape data for run "${runId}"`);
    }
    scrapeResult = {
      success: true,
      data: cached,
      duration: 0,
      phase: 'scrape',
      timestamp: new Date(),
    };
    logger.info('Scrape phase: loaded from persisted data');
  } else {
    metrics.startPhase('scrape');
    scrapeResult = await runScrapePhase(runId, fullConfig);
    metrics.completePhase('scrape', scrapeResult.success, scrapeResult.data?.totalPosts || 0);

    if (scrapeResult.success && scrapeResult.data) {
      savePhaseResult(runId, 'scrape', scrapeResult.data);
      updatePhaseStatus(runId, 'scrape', 'completed');
      updatePhaseStats(runId, 'scrape', {
        totalPosts: scrapeResult.data.totalPosts,
        reddit: scrapeResult.data.reddit.count,
        hn: scrapeResult.data.hn.count,
        twitter: scrapeResult.data.twitter.count,
        github: scrapeResult.data.github.count,
      });
    } else {
      updatePhaseStatus(runId, 'scrape', 'failed');
    }
  }

  if (!scrapeResult.success || !scrapeResult.data) {
    const isFatal = scrapeResult.severity !== 'degraded';
    logger.error({ severity: scrapeResult.severity ?? 'fatal' }, 'Scrape phase failed');
    errors.push({
      phase: 'scrape',
      message: scrapeResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: !isFatal,
      severity: scrapeResult.severity,
    });
    captureException(
      new Error(scrapeResult.error || 'Scrape phase failed'),
      { runId, phase: 'scrape', severity: scrapeResult.severity }
    );
    sendPipelineFailureAlert(runId, 'scrape', scrapeResult.error || 'Unknown error', scrapeResult.severity ?? 'fatal');
    if (isFatal) {
      return buildResult(runId, startedAt, fullConfig, { scrape: scrapeResult }, errors);
    }
  }

  // Phase 2: Analyze (requires scrape data)
  let analyzeResult: PhaseResult<AnalyzePhaseOutput>;

  if (shouldSkipPhase(resumePhase, 'analyze')) {
    const cached = loadPhaseResult<AnalyzePhaseOutput>(runId, 'analyze');
    if (!cached) {
      throw new Error(`Resume failed: could not load persisted analyze data for run "${runId}"`);
    }
    analyzeResult = {
      success: true,
      data: cached,
      duration: 0,
      phase: 'analyze',
      timestamp: new Date(),
    };
    logger.info('Analyze phase: loaded from persisted data');
  } else {
    metrics.startPhase('analyze');
    analyzeResult = scrapeResult.data?.posts?.length
      ? await runAnalyzePhase(runId, fullConfig, scrapeResult.data.posts)
      : { success: false, data: null, error: 'No posts from scrape phase', severity: 'fatal' as const, duration: 0, phase: 'analyze' as const, timestamp: new Date() };
    metrics.completePhase('analyze', analyzeResult.success, analyzeResult.data?.scoredCount || 0);

    if (analyzeResult.success && analyzeResult.data) {
      savePhaseResult(runId, 'analyze', analyzeResult.data);
      updatePhaseStatus(runId, 'analyze', 'completed');
      updatePhaseStats(runId, 'analyze', {
        clusterCount: analyzeResult.data.clusterCount,
        scoredCount: analyzeResult.data.scoredCount,
        gapAnalysisCount: analyzeResult.data.gapAnalysisCount,
      });
    } else {
      updatePhaseStatus(runId, 'analyze', 'failed');
    }
  }

  if (!analyzeResult.success || !analyzeResult.data) {
    const isFatal = analyzeResult.severity !== 'degraded';
    logger.error({ severity: analyzeResult.severity ?? 'fatal' }, 'Analyze phase failed');
    errors.push({
      phase: 'analyze',
      message: analyzeResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: !isFatal,
      severity: analyzeResult.severity,
    });
    captureException(
      new Error(analyzeResult.error || 'Analyze phase failed'),
      { runId, phase: 'analyze', severity: analyzeResult.severity }
    );
    sendPipelineFailureAlert(runId, 'analyze', analyzeResult.error || 'Unknown error', analyzeResult.severity ?? 'fatal');
    if (isFatal) {
      return buildResult(
        runId,
        startedAt,
        fullConfig,
        { scrape: scrapeResult, analyze: analyzeResult },
        errors
      );
    }
  }

  // Phase 3: Generate (requires analyze data)
  let generateResult: PhaseResult<GeneratePhaseOutput>;

  if (shouldSkipPhase(resumePhase, 'generate')) {
    const cached = loadPhaseResult<GeneratePhaseOutput>(runId, 'generate');
    if (!cached) {
      throw new Error(`Resume failed: could not load persisted generate data for run "${runId}"`);
    }
    generateResult = {
      success: true,
      data: cached,
      duration: 0,
      phase: 'generate',
      timestamp: new Date(),
    };
    logger.info('Generate phase: loaded from persisted data');
  } else {
    metrics.startPhase('generate');
    generateResult = analyzeResult.data?.scoredProblems?.length
      ? await runGeneratePhase(
          runId,
          fullConfig,
          analyzeResult.data.scoredProblems,
          analyzeResult.data.gapAnalyses
        )
      : { success: false, data: null, error: 'No scored problems from analyze phase', severity: 'fatal' as const, duration: 0, phase: 'generate' as const, timestamp: new Date() };
    metrics.completePhase('generate', generateResult.success, generateResult.data?.briefCount || 0);

    if (generateResult.success && generateResult.data) {
      savePhaseResult(runId, 'generate', generateResult.data);
      updatePhaseStatus(runId, 'generate', 'completed');
      updatePhaseStats(runId, 'generate', {
        briefCount: generateResult.data.briefCount,
      });
    } else {
      updatePhaseStatus(runId, 'generate', 'failed');
    }
  }

  if (!generateResult.success || !generateResult.data) {
    const isFatal = generateResult.severity !== 'degraded';
    logger.error({ severity: generateResult.severity ?? 'fatal' }, 'Generate phase failed');
    errors.push({
      phase: 'generate',
      message: generateResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: !isFatal,
      severity: generateResult.severity,
    });
    captureException(
      new Error(generateResult.error || 'Generate phase failed'),
      { runId, phase: 'generate', severity: generateResult.severity }
    );
    sendPipelineFailureAlert(runId, 'generate', generateResult.error || 'Unknown error', generateResult.severity ?? 'fatal');
    if (isFatal) {
      return buildResult(
        runId,
        startedAt,
        fullConfig,
        {
          scrape: scrapeResult,
          analyze: analyzeResult,
          generate: generateResult,
        },
        errors
      );
    }
  }

  // Phase 4: Deliver (degraded by default — delivery failures don't stop pipeline)
  metrics.startPhase('deliver');
  const deliverResult = generateResult.data?.briefs?.length
    ? await runDeliverPhase(runId, fullConfig, generateResult.data.briefs)
    : { success: true, data: { subscriberCount: 0, sent: 0, failed: 0, dryRun: fullConfig.dryRun }, duration: 0, phase: 'deliver' as const, timestamp: new Date() };
  metrics.completePhase('deliver', deliverResult.success, deliverResult.data?.sent || 0);

  if (deliverResult.success) {
    savePhaseResult(runId, 'deliver', deliverResult.data);
    updatePhaseStatus(runId, 'deliver', 'completed');
    if (deliverResult.data) {
      updatePhaseStats(runId, 'deliver', {
        sent: deliverResult.data.sent,
        failed: deliverResult.data.failed,
        subscriberCount: deliverResult.data.subscriberCount,
      });
    }
  } else {
    updatePhaseStatus(runId, 'deliver', 'failed');
    errors.push({
      phase: 'deliver',
      message: deliverResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: true,
      severity: deliverResult.severity ?? 'degraded',
    });
    captureException(
      new Error(deliverResult.error || 'Deliver phase failed'),
      { runId, phase: 'deliver', severity: deliverResult.severity ?? 'degraded' }
    );
    sendPipelineFailureAlert(runId, 'deliver', deliverResult.error || 'Unknown error', deliverResult.severity ?? 'degraded');
  }

  const result = buildResult(
    runId,
    startedAt,
    fullConfig,
    {
      scrape: scrapeResult,
      analyze: analyzeResult,
      generate: generateResult,
      deliver: deliverResult,
    },
    errors
  );

  // Attach API metrics to result
  result.apiMetrics = getGlobalMetrics().getSummary();

  // Persist run to database
  try {
    const briefSummaries = result.phases.generate.data?.briefs?.map(b => ({
      name: b.name,
      tagline: b.tagline,
      priorityScore: b.priorityScore,
      effortEstimate: b.effortEstimate,
    })) || [];

    await db.insert(pipelineRuns).values({
      runId: result.runId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      config: fullConfig,
      phases: {
        scrape: scrapeResult.success ? 'completed' : 'failed',
        analyze: analyzeResult.success ? 'completed' : 'failed',
        generate: generateResult.success ? 'completed' : 'failed',
        deliver: deliverResult.success ? 'completed' : 'failed',
      },
      stats: result.stats,
      success: result.success,
      totalDuration: result.totalDuration,
      errors: result.errors,
      apiMetrics: result.apiMetrics || null,
      briefSummaries,
    }).onConflictDoNothing();

    logger.info({ runId }, 'Pipeline run persisted to database');
  } catch (dbError) {
    logger.warn(
      { error: dbError instanceof Error ? dbError.message : String(dbError) },
      'Failed to persist pipeline run to database (non-fatal)'
    );
  }

  const summary = metrics.getSummary();
  logger.info(
    { summary, success: result.success },
    'Pipeline completed'
  );

  return result;
}
