/**
 * Pipeline Orchestrator
 *
 * Coordinates the execution of all pipeline phases in sequence.
 */

import { createRunLogger } from './utils/logger';
import { MetricsCollector } from './utils/metrics';
import { getGlobalMetrics, resetGlobalMetrics } from './utils/api-metrics';
import { runScrapePhase } from './phases/scrape';
import { runAnalyzePhase } from './phases/analyze';
import { runGeneratePhase } from './phases/generate';
import { runDeliverPhase } from './phases/deliver';
import type {
  PipelineConfig,
  PipelineResult,
  PhaseResult,
  ScrapePhaseOutput,
  AnalyzePhaseOutput,
  GeneratePhaseOutput,
  DeliverPhaseOutput,
  PipelineError,
} from './types';

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  hoursBack: 24,
  scrapers: {
    reddit: true,
    hn: true,
    twitter: true,
    github: true,
  },
  clusteringThreshold: 0.85,
  minFrequencyForGap: 2,
  maxBriefs: 10,
  minPriorityScore: 0.5,
  dryRun: false,
  verbose: false,
  reportMetrics: false,
};

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
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
 * Run the complete IdeaForge pipeline
 */
export async function runPipeline(
  config: Partial<PipelineConfig> = {}
): Promise<PipelineResult> {
  const fullConfig = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  const runId = generateRunId();
  const logger = createRunLogger(runId);
  const metrics = new MetricsCollector(runId);
  const errors: PipelineError[] = [];

  // Reset API metrics at start if collecting
  if (fullConfig.reportMetrics) {
    resetGlobalMetrics();
  }

  const startedAt = new Date();

  logger.info({ config: fullConfig }, 'Pipeline started');

  // Phase 1: Scrape
  metrics.startPhase('scrape');
  const scrapeResult = await runScrapePhase(runId, fullConfig);
  metrics.completePhase('scrape', scrapeResult.success, scrapeResult.data?.totalPosts || 0);

  if (!scrapeResult.success || !scrapeResult.data) {
    logger.error('Pipeline aborted: scrape phase failed');
    errors.push({
      phase: 'scrape',
      message: scrapeResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: false,
    });
    return buildResult(runId, startedAt, fullConfig, { scrape: scrapeResult }, errors);
  }

  // Phase 2: Analyze
  metrics.startPhase('analyze');
  const analyzeResult = await runAnalyzePhase(
    runId,
    fullConfig,
    scrapeResult.data.posts
  );
  metrics.completePhase('analyze', analyzeResult.success, analyzeResult.data?.scoredCount || 0);

  if (!analyzeResult.success || !analyzeResult.data) {
    logger.error('Pipeline aborted: analyze phase failed');
    errors.push({
      phase: 'analyze',
      message: analyzeResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: false,
    });
    return buildResult(
      runId,
      startedAt,
      fullConfig,
      { scrape: scrapeResult, analyze: analyzeResult },
      errors
    );
  }

  // Phase 3: Generate
  metrics.startPhase('generate');
  const generateResult = await runGeneratePhase(
    runId,
    fullConfig,
    analyzeResult.data.scoredProblems,
    analyzeResult.data.gapAnalyses
  );
  metrics.completePhase('generate', generateResult.success, generateResult.data?.briefCount || 0);

  if (!generateResult.success || !generateResult.data) {
    logger.error('Pipeline aborted: generate phase failed');
    errors.push({
      phase: 'generate',
      message: generateResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: false,
    });
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

  // Phase 4: Deliver
  metrics.startPhase('deliver');
  const deliverResult = await runDeliverPhase(
    runId,
    fullConfig,
    generateResult.data.briefs
  );
  metrics.completePhase('deliver', deliverResult.success, deliverResult.data?.sent || 0);

  if (!deliverResult.success) {
    errors.push({
      phase: 'deliver',
      message: deliverResult.error || 'Unknown error',
      timestamp: new Date(),
      recoverable: true,
    });
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

  // Add API metrics to result if collecting
  if (fullConfig.reportMetrics) {
    result.apiMetrics = getGlobalMetrics().getSummary();
  }

  const summary = metrics.getSummary();
  logger.info(
    { summary, success: result.success },
    'Pipeline completed'
  );

  return result;
}
