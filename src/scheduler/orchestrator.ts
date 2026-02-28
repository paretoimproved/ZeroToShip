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
  cleanupStaleRuns,
} from './utils/persistence';
import type { PhaseStats } from './utils/persistence';
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
const DEFAULT_MIN_PRIORITY_SCORE = 20;

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
  const requestedGenerationMode = fullConfig.generationMode ?? getConfiguredGenerationMode();

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

  // Clean up stale runs before acquiring the lock (safety net for crashed processes)
  await cleanupStaleRuns();

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
  let result: PipelineResult | undefined;

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

  // --- Generic phase executor (handles resume, persist, error, lock-loss) ---

  type PhaseAccumulator = {
    scrape?: PhaseResult<ScrapePhaseOutput>;
    analyze?: PhaseResult<AnalyzePhaseOutput>;
    generate?: PhaseResult<GeneratePhaseOutput>;
    deliver?: PhaseResult<DeliverPhaseOutput>;
  };

  /**
   * Execute a pipeline phase with full boilerplate:
   * 1. Resume/skip check — load cached data if the phase already completed
   * 2. Run the phase — record metrics
   * 3. Persist result + update phase status/stats
   * 4. Handle failure — log, push error, capture exception, send alert
   * 5. Check for lock loss — abort if lost
   *
   * Returns `{ phaseResult, earlyReturn }`. If `earlyReturn` is set, the
   * caller must return it immediately (fatal failure or lock loss).
   */
  async function executePhase<T, P extends PhaseName>(opts: {
    phase: P;
    runner: () => Promise<PhaseResult<T>>;
    statsExtractor: (data: T) => NonNullable<PhaseStats[P]>;
    metricCountExtractor: (data: T | null) => number;
    priorPhases: PhaseAccumulator;
  }): Promise<{
    phaseResult: PhaseResult<T>;
    earlyReturn: PipelineResult | null;
  }> {
    const { phase, runner, statsExtractor, metricCountExtractor, priorPhases } = opts;
    let phaseResult: PhaseResult<T>;

    // Step 1: Resume/skip check
    if (shouldSkipPhase(resumePhase, phase)) {
      const cached = await loadPhaseResult<T>(runId, phase);
      if (!cached) {
        throw new Error(`Resume failed: could not load persisted ${phase} data for run "${runId}"`);
      }
      phaseResult = {
        success: true,
        data: cached,
        duration: 0,
        phase,
        timestamp: new Date(),
      };
      logger.info(`${phase.charAt(0).toUpperCase() + phase.slice(1)} phase: loaded from persisted data`);
    } else {
      // Step 2: Run the phase and record metrics
      metrics.startPhase(phase);
      phaseResult = await runner();
      metrics.completePhase(phase, phaseResult.success, metricCountExtractor(phaseResult.data));

      // Step 3: Persist result + update status/stats
      if (phaseResult.success && phaseResult.data) {
        await savePhaseResult(runId, phase, phaseResult.data);
        await updatePhaseStatus(runId, phase, 'completed');
        await updatePhaseStats(runId, phase, statsExtractor(phaseResult.data));
      } else {
        await updatePhaseStatus(runId, phase, 'failed');
      }
    }

    // Include this phase's result alongside prior phases for buildResult/abortForLockLoss
    const phasesIncludingSelf: PhaseAccumulator = {
      ...priorPhases,
      [phase]: phaseResult,
    };

    // Step 4: Handle failure
    if (!phaseResult.success || !phaseResult.data) {
      const isFatal = phaseResult.severity !== 'degraded';
      const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);
      logger.error({ severity: phaseResult.severity ?? 'fatal' }, `${phaseLabel} phase failed`);
      errors.push({
        phase,
        message: phaseResult.error || 'Unknown error',
        timestamp: new Date(),
        recoverable: !isFatal,
        severity: phaseResult.severity,
      });
      captureException(
        new Error(phaseResult.error || `${phaseLabel} phase failed`),
        { runId, phase, severity: phaseResult.severity }
      );
      sendPipelineFailureAlert(runId, phase, phaseResult.error || 'Unknown error', phaseResult.severity ?? 'fatal');
      if (isFatal) {
        const earlyReturn = buildResult(runId, startedAt, fullConfig, phasesIncludingSelf, errors);
        return { phaseResult, earlyReturn };
      }
    }

    // Step 5: Check for lock loss
    const lockLossResult = abortForLockLoss(phase, phasesIncludingSelf);
    if (lockLossResult) {
      return { phaseResult, earlyReturn: lockLossResult };
    }

    return { phaseResult, earlyReturn: null };
  }

  // Phase 1: Scrape
  const { phaseResult: scrapeResult, earlyReturn: scrapeEarly } = await executePhase<ScrapePhaseOutput, 'scrape'>({
    phase: 'scrape',
    runner: () => runScrapePhase(runId, fullConfig),
    statsExtractor: (data) => ({
      totalPosts: data.totalPosts,
      reddit: data.reddit.count,
      hn: data.hn.count,
      twitter: data.twitter.count,
      github: data.github.count,
    }),
    metricCountExtractor: (data) => data?.totalPosts || 0,
    priorPhases: {},
  });
  if (scrapeEarly) { result = scrapeEarly; return result; }

  // Phase 2: Analyze (requires scrape data)
  const { phaseResult: analyzeResult, earlyReturn: analyzeEarly } = await executePhase<AnalyzePhaseOutput, 'analyze'>({
    phase: 'analyze',
    runner: () => scrapeResult.data?.posts?.length
      ? runAnalyzePhase(runId, fullConfig, scrapeResult.data.posts)
      : Promise.resolve({ success: false, data: null, error: 'No posts from scrape phase', severity: 'fatal' as const, duration: 0, phase: 'analyze' as const, timestamp: new Date() }),
    statsExtractor: (data) => ({
      clusterCount: data.clusterCount,
      scoredCount: data.scoredCount,
      gapAnalysisCount: data.gapAnalysisCount,
    }),
    metricCountExtractor: (data) => data?.scoredCount || 0,
    priorPhases: { scrape: scrapeResult },
  });
  if (analyzeEarly) { result = analyzeEarly; return result; }

  // Phase 3: Generate (requires analyze data)
  const { phaseResult: generateResult, earlyReturn: generateEarly } = await executePhase<GeneratePhaseOutput, 'generate'>({
    phase: 'generate',
    runner: () => analyzeResult.data?.scoredProblems?.length
      ? runGeneratePhase(
          runId,
          fullConfig,
          analyzeResult.data.scoredProblems,
          analyzeResult.data.gapAnalyses,
          requestedGenerationMode,
        )
      : Promise.resolve({ success: false, data: null, error: 'No scored problems from analyze phase', severity: 'fatal' as const, duration: 0, phase: 'generate' as const, timestamp: new Date() }),
    statsExtractor: (data) => ({
      briefCount: data.briefCount,
    }),
    metricCountExtractor: (data) => data?.briefCount || 0,
    priorPhases: { scrape: scrapeResult, analyze: analyzeResult },
  });
  if (generateEarly) { result = generateEarly; return result; }

  // Phase 4: Deliver (degraded by default — delivery failures don't stop pipeline)
  metrics.startPhase('deliver');
  const publishGateEnabled = Boolean(fullConfig.publishGate?.enabled);
  const needsPublishReview = publishGateEnabled
    && (generateResult.data?.diagnostics?.publishGate?.needsReviewCount ?? 0) > 0;

  // Filter out fallback briefs (placeholder content from API failures)
  const deliverableBriefs = (generateResult.data?.briefs ?? []).filter(
    (b) => !b.generationMeta?.isFallback
  );

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
    : deliverableBriefs.length
      ? await runDeliverPhase(runId, fullConfig, deliverableBriefs)
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
  if (lockLossAfterDeliver) { result = lockLossAfterDeliver; return result; }

  result = buildResult(
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

  const summary = metrics.getSummary();
  logger.info(
    { summary, success: result.success },
    'Pipeline completed'
  );

  return result;
  } finally {
    // Finalize the pipeline run in the database. This is in `finally` so
    // the status update executes even if the process hit an unexpected
    // error (e.g. EPIPE) between buildResult and here.
    if (result) {
      try {
        const finalApiMetrics = result.apiMetrics ?? getGlobalMetrics().getSummary();
        const generationDiagnostics = buildGenerationDiagnosticsSnapshot(
          result.phases.generate,
          finalApiMetrics,
        );

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

        const finalStatus = result.phases.deliver.data?.skipped
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
            apiMetrics: finalApiMetrics || null,
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
    }

    stopLockHeartbeat?.();
    await releasePipelineLock(runId);
  }
}
