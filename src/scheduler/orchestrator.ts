/**
 * Pipeline Orchestrator
 *
 * Coordinates the execution of all pipeline phases in sequence.
 */

import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { createRunLogger } from './utils/logger';
import { MetricsCollector } from './utils/metrics';
import { getGlobalMetrics, resetGlobalMetrics } from './utils/api-metrics';
import type { ApiMetricsSummary } from './utils/api-metrics';
import { runScrapePhase } from './phases/scrape';
import { runAnalyzePhase } from './phases/analyze';
import { runGeneratePhase } from './phases/generate';
import { runDeliverPhase } from './phases/deliver';
import { getConfiguredGenerationMode } from '../generation/providers';
import { initMonitoring, captureException } from '../lib/monitoring';
import { sendPipelineFailureAlert } from '../lib/alerts';
import {
  acquirePipelineLock,
  extendPipelineLock,
  releasePipelineLock,
  PIPELINE_LOCK_TTL_SECONDS,
} from '../lib/pipeline-lock';
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
  GenerationDiagnosticsSnapshot,
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

/** Heartbeat interval for renewing the pipeline lock while a run is active */
const PIPELINE_LOCK_HEARTBEAT_INTERVAL_MS = 60_000;

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
  publishGate: {
    enabled: false,
    confidenceThreshold: 0.85,
  },
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
 * Build a run-level diagnostics snapshot that can be persisted to pipeline_runs.
 */
function buildGenerationDiagnosticsSnapshot(
  generatePhase: PhaseResult<GeneratePhaseOutput>,
  apiMetrics: ApiMetricsSummary,
): GenerationDiagnosticsSnapshot {
  const diagnostics = generatePhase.data?.diagnostics;
  const generatedBriefCount = generatePhase.data?.briefCount ?? 0;
  const costPerBriefUsd = generatedBriefCount > 0
    ? Number((apiMetrics.estimatedCost / generatedBriefCount).toFixed(6))
    : null;
  const latencyPerBriefMs = generatedBriefCount > 0
    ? Math.round(generatePhase.duration / generatedBriefCount)
    : null;

  if (!diagnostics) {
    return {
      taxonomyVersion: 'v1',
      generatedBriefCount,
      qualityPassCount: 0,
      qualityFailCount: 0,
      qualityPassRate: 0,
      fallbackCount: 0,
      fallbackRate: 0,
      fallbackReasonCounts: {
        missing_gap_analysis: 0,
        missing_api_key: 0,
        single_call_failed: 0,
        batch_call_failed: 0,
        unknown: 0,
      },
      qualityFailureReasonCounts: {
        placeholder_content: 0,
        length_too_short: 0,
        list_minimum_not_met: 0,
        nested_content_incomplete: 0,
        unknown: 0,
      },
      costPerBriefUsd,
      latencyPerBriefMs,
    };
  }

  return {
    ...diagnostics,
    costPerBriefUsd,
    latencyPerBriefMs,
  };
}

/**
 * Start periodic lock renewal so long-running pipeline runs keep lock ownership.
 * Returns a function that stops the heartbeat timer.
 */
function startPipelineLockHeartbeat(
  runId: string,
  logger: ReturnType<typeof createRunLogger>,
  onLockLost: () => void,
): () => void {
  let timer: NodeJS.Timeout | null = null;
  let inFlight = false;

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;

    try {
      const renewed = await extendPipelineLock(runId, PIPELINE_LOCK_TTL_SECONDS);
      if (!renewed) {
        logger.error(
          { runId },
          'Pipeline lock ownership lost during run'
        );
        onLockLost();
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(() => {
    void tick();
  }, PIPELINE_LOCK_HEARTBEAT_INTERVAL_MS);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/**
 * Run the complete ZeroToShip pipeline
 *
 * Supports resuming from a previous failed run via `config.resumeRunId`.
 * When resuming, completed phase results are loaded from the database and the
 * pipeline picks up from the first incomplete phase.
 */
export async function runPipeline(
  config: Partial<PipelineConfig> = {},
  preGeneratedRunId?: string
): Promise<PipelineResult> {
  const fullConfig = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  const requestedGenerationMode = getConfiguredGenerationMode();

  // Determine run ID and resume state
  let runId: string;
  let resumePhase: PhaseName | null = null;

  if (fullConfig.resumeRunId) {
    const previousStatus = await loadRunStatus(fullConfig.resumeRunId);
    if (!previousStatus) {
      throw new Error(
        `Cannot resume run "${fullConfig.resumeRunId}": run not found in database`
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

  // Acquire distributed lock to prevent concurrent pipeline runs
  const lockAcquired = await acquirePipelineLock(runId, PIPELINE_LOCK_TTL_SECONDS);
  if (!lockAcquired) {
    logger.warn('Pipeline lock is held by another run — skipping');
    const now = new Date();
    return buildResult(runId, now, fullConfig, {}, [
      {
        phase: 'scrape',
        message: 'Pipeline lock held by another run',
        timestamp: now,
        recoverable: true,
        severity: 'degraded',
      },
    ]);
  }

  let lockLost = false;
  let stopLockHeartbeat: (() => void) | null = null;

  try {
  const metrics = new MetricsCollector(runId);
  const errors: PipelineError[] = [];

  // Reset API metrics at start
  resetGlobalMetrics();

  const startedAt = new Date();
  stopLockHeartbeat = startPipelineLockHeartbeat(runId, logger, () => {
    lockLost = true;
  });

  // Initialize monitoring
  initMonitoring();

  const abortForLockLoss = (
    phase: PhaseName,
    phases: {
      scrape?: PhaseResult<ScrapePhaseOutput>;
      analyze?: PhaseResult<AnalyzePhaseOutput>;
      generate?: PhaseResult<GeneratePhaseOutput>;
      deliver?: PhaseResult<DeliverPhaseOutput>;
    },
  ): PipelineResult | null => {
    if (!lockLost) return null;

    errors.push({
      phase,
      message: 'Pipeline lock ownership lost during run',
      timestamp: new Date(),
      recoverable: false,
      severity: 'fatal',
    });

    logger.error({ phase }, 'Aborting pipeline run after lock ownership loss');
    return buildResult(runId, startedAt, fullConfig, phases, errors);
  };

  if (resumePhase) {
    logger.info(
      { config: fullConfig, resumePhase, requestedGenerationMode },
      'Pipeline resuming from previous run'
    );
  } else {
    logger.info({ config: fullConfig, requestedGenerationMode }, 'Pipeline started');
    await initRunStatus(runId, fullConfig);
  }

  // Phase 1: Scrape
  let scrapeResult: PhaseResult<ScrapePhaseOutput>;

  if (shouldSkipPhase(resumePhase, 'scrape')) {
    const cached = await loadPhaseResult<ScrapePhaseOutput>(runId, 'scrape');
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
      await savePhaseResult(runId, 'scrape', scrapeResult.data);
      await updatePhaseStatus(runId, 'scrape', 'completed');
      await updatePhaseStats(runId, 'scrape', {
        totalPosts: scrapeResult.data.totalPosts,
        reddit: scrapeResult.data.reddit.count,
        hn: scrapeResult.data.hn.count,
        twitter: scrapeResult.data.twitter.count,
        github: scrapeResult.data.github.count,
      });
    } else {
      await updatePhaseStatus(runId, 'scrape', 'failed');
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

  const lockLossAfterScrape = abortForLockLoss('scrape', { scrape: scrapeResult });
  if (lockLossAfterScrape) return lockLossAfterScrape;

  // Phase 2: Analyze (requires scrape data)
  let analyzeResult: PhaseResult<AnalyzePhaseOutput>;

  if (shouldSkipPhase(resumePhase, 'analyze')) {
    const cached = await loadPhaseResult<AnalyzePhaseOutput>(runId, 'analyze');
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
      await savePhaseResult(runId, 'analyze', analyzeResult.data);
      await updatePhaseStatus(runId, 'analyze', 'completed');
      await updatePhaseStats(runId, 'analyze', {
        clusterCount: analyzeResult.data.clusterCount,
        scoredCount: analyzeResult.data.scoredCount,
        gapAnalysisCount: analyzeResult.data.gapAnalysisCount,
      });
    } else {
      await updatePhaseStatus(runId, 'analyze', 'failed');
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

  const lockLossAfterAnalyze = abortForLockLoss('analyze', {
    scrape: scrapeResult,
    analyze: analyzeResult,
  });
  if (lockLossAfterAnalyze) return lockLossAfterAnalyze;

  // Phase 3: Generate (requires analyze data)
  let generateResult: PhaseResult<GeneratePhaseOutput>;

  if (shouldSkipPhase(resumePhase, 'generate')) {
    const cached = await loadPhaseResult<GeneratePhaseOutput>(runId, 'generate');
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
          analyzeResult.data.gapAnalyses,
          requestedGenerationMode,
        )
      : { success: false, data: null, error: 'No scored problems from analyze phase', severity: 'fatal' as const, duration: 0, phase: 'generate' as const, timestamp: new Date() };
    metrics.completePhase('generate', generateResult.success, generateResult.data?.briefCount || 0);

    if (generateResult.success && generateResult.data) {
      await savePhaseResult(runId, 'generate', generateResult.data);
      await updatePhaseStatus(runId, 'generate', 'completed');
      await updatePhaseStats(runId, 'generate', {
        briefCount: generateResult.data.briefCount,
      });
    } else {
      await updatePhaseStatus(runId, 'generate', 'failed');
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

  const lockLossAfterGenerate = abortForLockLoss('generate', {
    scrape: scrapeResult,
    analyze: analyzeResult,
    generate: generateResult,
  });
  if (lockLossAfterGenerate) return lockLossAfterGenerate;

  // Phase 4: Deliver (degraded by default — delivery failures don't stop pipeline)
  metrics.startPhase('deliver');
  const publishGateEnabled = Boolean(fullConfig.publishGate?.enabled);
  const needsPublishReview = publishGateEnabled
    && (generateResult.data?.diagnostics?.publishGate?.needsReviewCount ?? 0) > 0;

  const deliverResult = needsPublishReview
    ? {
      success: true,
      data: {
        subscriberCount: 0,
        sent: 0,
        failed: 0,
        dryRun: fullConfig.dryRun,
        skipped: true,
        skippedReason: 'publish_gate_review_required' as const,
      },
      duration: 0,
      phase: 'deliver' as const,
      timestamp: new Date(),
    }
    : generateResult.data?.briefs?.length
      ? await runDeliverPhase(runId, fullConfig, generateResult.data.briefs)
      : { success: true, data: { subscriberCount: 0, sent: 0, failed: 0, dryRun: fullConfig.dryRun }, duration: 0, phase: 'deliver' as const, timestamp: new Date() };
  metrics.completePhase('deliver', deliverResult.success, deliverResult.data?.sent || 0);

  if (deliverResult.success) {
    await savePhaseResult(runId, 'deliver', deliverResult.data);
    const deliverOutcome = deliverResult.data?.skipped ? 'blocked' : 'completed';
    await updatePhaseStatus(runId, 'deliver', deliverOutcome);
    if (deliverResult.data) {
      await updatePhaseStats(runId, 'deliver', {
        sent: deliverResult.data.sent,
        failed: deliverResult.data.failed,
        subscriberCount: deliverResult.data.subscriberCount,
      });
    }
  } else {
    await updatePhaseStatus(runId, 'deliver', 'failed');
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

  const lockLossAfterDeliver = abortForLockLoss('deliver', {
    scrape: scrapeResult,
    analyze: analyzeResult,
    generate: generateResult,
    deliver: {
      ...deliverResult,
      success: false,
      error: 'Pipeline lock ownership lost during run',
    },
  });
  if (lockLossAfterDeliver) return lockLossAfterDeliver;

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
  const apiMetrics = getGlobalMetrics().getSummary();
  result.apiMetrics = apiMetrics;
  const generationDiagnostics = buildGenerationDiagnosticsSnapshot(
    result.phases.generate,
    apiMetrics
  );

  // Update the pipeline run row with final results
  try {
    const briefSummaries = result.phases.generate.data?.briefs?.map(b => ({
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      priorityScore: b.priorityScore,
      effortEstimate: b.effortEstimate,
      generationMeta: b.generationMeta
        ? {
          isFallback: b.generationMeta.isFallback,
          fallbackReason: b.generationMeta.fallbackReason,
          providerMode: b.generationMeta.providerMode,
          graphAttemptCount: b.generationMeta.graphAttemptCount,
          graphModelsUsed: b.generationMeta.graphModelsUsed,
          graphFailedSections: b.generationMeta.graphFailedSections,
          graphRetriedSections: b.generationMeta.graphRetriedSections,
          graphTrace: b.generationMeta.graphTrace,
          handoffMeta: b.generationMeta.handoffMeta,
          publishDecision: b.generationMeta.publishDecision,
          publishConfidence: b.generationMeta.publishConfidence,
        }
        : null,
    })) || [];

    const finalStatus = deliverResult.data?.skipped
      ? 'needs_review'
      : result.success
        ? 'completed'
        : 'failed';

    await db.update(pipelineRuns)
      .set({
        status: finalStatus,
        completedAt: result.completedAt,
        stats: result.stats,
        success: result.success,
        totalDuration: result.totalDuration,
        errors: result.errors,
        apiMetrics: result.apiMetrics || null,
        briefSummaries,
        generationMode: result.phases.generate.data?.generationMode ?? 'legacy',
        generationDiagnostics,
        updatedAt: new Date(),
      })
      .where(eq(pipelineRuns.runId, runId));

    logger.info({ runId }, 'Pipeline run finalized in database');
  } catch (dbError) {
    logger.warn(
      { error: dbError instanceof Error ? dbError.message : String(dbError) },
      'Failed to finalize pipeline run in database (non-fatal)'
    );
  }

  const summary = metrics.getSummary();
  logger.info(
    { summary, success: result.success },
    'Pipeline completed'
  );

  return result;
  } finally {
    stopLockHeartbeat?.();
    await releasePipelineLock(runId);
  }
}
