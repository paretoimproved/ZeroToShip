/**
 * Generate Phase Runner
 *
 * Creates business briefs from scored problems and gap analyses.
 */

import { validateBriefQuality } from '../../generation/brief-generator';
import { computeEvidenceStrength, type ScoredProblem } from '../../analysis/scorer';
import type { GapAnalysis } from '../../analysis/gap-analyzer';
import { cosineSimilarity } from '../../analysis/similarity';
import { selectGenerationProvider } from '../../generation/providers';
import { GraphBudgetManager } from '../../generation/graph/budget';
import { createPhaseLogger } from '../utils/logger';
import { AnalysisError, wrapError } from '../../lib/errors';
import type {
  GenerationMode,
  FallbackReasonCode,
  GeneratePhaseDiagnostics,
  PhaseResult,
  GeneratePhaseOutput,
  PipelineConfig,
  QualityFailureReasonCode,
} from '../types';
import { getPipelineBriefModel } from '../../config/models';
import { config as envConfig } from '../../config/env';
import { db, ideas } from '../../api/db/client';
import { eq, isNotNull, and } from 'drizzle-orm';

/** Similarity threshold for post-filter deduplication of scored problems */
const BRIEF_DEDUP_THRESHOLD = 0.85;

/** ideas.category is varchar(100) */
const IDEA_CATEGORY_MAX_LENGTH = 100;

function truncateVarchar(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

const FALLBACK_REASON_CODES: FallbackReasonCode[] = [
  'missing_gap_analysis',
  'missing_api_key',
  'single_call_failed',
  'batch_call_failed',
  'unknown',
];

const QUALITY_FAILURE_REASON_CODES: QualityFailureReasonCode[] = [
  'placeholder_content',
  'length_too_short',
  'list_minimum_not_met',
  'nested_content_incomplete',
  'unknown',
];

function initReasonCounter<T extends string>(codes: T[]): Record<T, number> {
  const entries = codes.map((code) => [code, 0] as const);
  return Object.fromEntries(entries) as Record<T, number>;
}

function classifyQualityReason(reason: string): QualityFailureReasonCode {
  const normalized = reason.toLowerCase();

  if (normalized.includes('placeholder content')) {
    return 'placeholder_content';
  }

  if (normalized.includes('too short')) {
    return 'length_too_short';
  }

  if (normalized.includes('need >=')) {
    return 'list_minimum_not_met';
  }

  if (normalized.includes('tech stack')) {
    return 'nested_content_incomplete';
  }

  return 'unknown';
}

function buildGenerateDiagnostics(
  validatedBriefs: Array<{
    brief: {
      generationMeta?: {
        isFallback?: boolean;
        fallbackReason?: string;
      };
    };
    quality: {
      valid: boolean;
      reasons: string[];
    };
  }>,
): GeneratePhaseDiagnostics {
  const total = validatedBriefs.length;
  const fallbackReasonCounts = initReasonCounter(FALLBACK_REASON_CODES);
  const qualityFailureReasonCounts = initReasonCounter(QUALITY_FAILURE_REASON_CODES);

  let fallbackCount = 0;
  let qualityPassCount = 0;
  let qualityFailCount = 0;

  for (const { brief, quality } of validatedBriefs) {
    if (quality.valid) {
      qualityPassCount++;
    } else {
      qualityFailCount++;
      for (const reason of quality.reasons) {
        const code = classifyQualityReason(reason);
        qualityFailureReasonCounts[code] += 1;
      }
    }

    if (brief.generationMeta?.isFallback) {
      fallbackCount++;
      const reason = brief.generationMeta.fallbackReason;
      if (reason && reason in fallbackReasonCounts) {
        fallbackReasonCounts[reason as FallbackReasonCode] += 1;
      } else {
        fallbackReasonCounts.unknown += 1;
      }
    }
  }

  const qualityPassRate = total > 0 ? qualityPassCount / total : 0;
  const fallbackRate = total > 0 ? fallbackCount / total : 0;

  return {
    taxonomyVersion: 'v1',
    generatedBriefCount: total,
    qualityPassCount,
    qualityFailCount,
    qualityPassRate,
    fallbackCount,
    fallbackRate,
    fallbackReasonCounts,
    qualityFailureReasonCounts,
  };
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function computePublishConfidence(
  brief: { generationMeta?: { isFallback?: boolean; graphAttemptCount?: number } },
  quality: { valid: boolean },
): number {
  // Heuristic confidence until Phase 6 introduces an eval harness scorer.
  // Bias toward review when we see fallbacks or multiple graph attempts.
  let score = quality.valid ? 0.9 : 0.1;
  if (brief.generationMeta?.isFallback) score -= 0.5;
  const attempts = brief.generationMeta?.graphAttemptCount ?? 1;
  if (attempts > 1) score -= 0.1 * Math.min(3, attempts - 1);
  return clamp01(score);
}

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
 * Deduplicate new problems against previously published briefs in the database.
 * Compares each new problem's cluster centroid embedding against existing brief
 * embeddings. Skips problems that are too similar to an already-published brief.
 */
export async function deduplicateAgainstExisting(
  problems: ScoredProblem[],
  threshold: number = BRIEF_DEDUP_THRESHOLD,
  logger?: ReturnType<typeof createPhaseLogger>,
): Promise<ScoredProblem[]> {
  try {
    const rows = await db
      .select({ embedding: ideas.embedding })
      .from(ideas)
      .where(and(eq(ideas.isPublished, true), isNotNull(ideas.embedding)));

    const existingEmbeddings = rows
      .map((row) => row.embedding)
      .filter((emb): emb is number[] => Array.isArray(emb) && emb.length > 0);

    if (existingEmbeddings.length === 0) {
      return problems;
    }

    const filtered: ScoredProblem[] = [];
    let removed = 0;

    for (const problem of problems) {
      if (!problem.embedding || problem.embedding.length === 0) {
        filtered.push(problem);
        continue;
      }

      const isDuplicate = existingEmbeddings.some(
        (existing) => cosineSimilarity(problem.embedding, existing) >= threshold,
      );

      if (isDuplicate) {
        removed++;
        logger?.info(
          { problemId: problem.id, problemStatement: problem.problemStatement },
          'Skipped problem — cross-run duplicate of existing published brief',
        );
      } else {
        filtered.push(problem);
      }
    }

    if (removed > 0) {
      logger?.info(
        { removed, threshold, existingBriefCount: existingEmbeddings.length },
        'Cross-run deduplication removed problems matching existing briefs',
      );
    }

    return filtered;
  } catch (error) {
    logger?.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Cross-run deduplication failed — proceeding with all problems (graceful fallback)',
    );
    return problems;
  }
}

/**
 * Run the generate phase
 */
export async function runGeneratePhase(
  runId: string,
  config: PipelineConfig,
  scoredProblems: ScoredProblem[],
  gapAnalyses: Map<string, GapAnalysis>,
  requestedGenerationMode: GenerationMode = 'legacy',
): Promise<PhaseResult<GeneratePhaseOutput>> {
  const logger = createPhaseLogger(runId, 'generate');
  const startTime = Date.now();
  const selection = selectGenerationProvider(requestedGenerationMode);

  logger.info(
    {
      problemCount: scoredProblems.length,
      maxBriefs: config.maxBriefs,
      requestedGenerationMode: selection.requestedMode,
      generationMode: selection.effectiveMode,
    },
    'Starting generate phase'
  );

  try {
    // Filter by minimum priority, then deduplicate similar problems
    const eligibleProblems = scoredProblems
      .filter((p) => p.scores.priority >= config.minPriorityScore);

    const { selected: withinRunDeduped, removed: dedupRemoved } =
      deduplicateByEmbedding(eligibleProblems, config.maxBriefs);

    if (dedupRemoved > 0) {
      logger.info(
        { removed: dedupRemoved, threshold: BRIEF_DEDUP_THRESHOLD },
        'Removed similar problems via embedding deduplication'
      );
    }

    // Cross-run dedup: remove problems that match existing published briefs
    const filteredProblems = await deduplicateAgainstExisting(
      withinRunDeduped,
      BRIEF_DEDUP_THRESHOLD,
      logger,
    );

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

    // Compute evidence strength for each problem before generation.
    // Both legacy and graph providers receive this metadata on the problem object
    // so prompt builders can calibrate confidence levels.
    for (const problem of filteredProblems) {
      problem.evidenceMetadata = computeEvidenceStrength(problem);
    }

    const evidenceCounts = { strong: 0, moderate: 0, weak: 0 };
    for (const p of filteredProblems) {
      evidenceCounts[p.evidenceMetadata!.tier]++;
    }
    logger.info(evidenceCounts, 'Evidence strength distribution');

    const hasGraphBudgetCaps =
      selection.effectiveMode === 'graph' &&
      (typeof envConfig.GRAPH_RUN_BUDGET_USD === 'number' ||
        typeof envConfig.GRAPH_RUN_BUDGET_TOKENS === 'number');
    const budgetManager = hasGraphBudgetCaps
      ? new GraphBudgetManager({
        runBudgetUsd: envConfig.GRAPH_RUN_BUDGET_USD,
        runBudgetTokens: envConfig.GRAPH_RUN_BUDGET_TOKENS,
      })
      : null;

    // Build evidence lookup keyed by problemStatement for DB persistence after generation
    const problemEvidenceMap = new Map(
      filteredProblems.map((p) => [
        p.problemStatement,
        { evidenceMetadata: p.evidenceMetadata, embedding: p.embedding },
      ]),
    );

    // Generate briefs with tier-appropriate model
    const briefs = await selection.provider.generate({
      scoredProblems: filteredProblems,
      gapAnalyses,
      config: {
        model: getPipelineBriefModel(),
        maxAttempts: envConfig.GRAPH_MAX_ATTEMPTS,
        maxSectionRetries: envConfig.GRAPH_MAX_SECTION_RETRIES,
        maxConcurrent: envConfig.GRAPH_MAX_CONCURRENT_BRIEFS,
        runBudgetUsd: envConfig.GRAPH_RUN_BUDGET_USD,
        runBudgetTokens: envConfig.GRAPH_RUN_BUDGET_TOKENS,
        handoffProvider: envConfig.HANDOFF_PROVIDER,
        handoffUrl: envConfig.N8N_HANDOFF_URL,
        handoffApiKey: envConfig.N8N_HANDOFF_API_KEY || undefined,
        handoffTimeoutMs: envConfig.HANDOFF_TIMEOUT_MS,
        handoffMaxFailures: envConfig.HANDOFF_MAX_FAILURES,
      },
    });

    const validatedBriefs = briefs.map(brief => {
      const quality = validateBriefQuality(brief);
      if (!quality.valid) {
        logger.warn(
          { briefName: brief.name, reasons: quality.reasons },
          'Brief failed quality validation — will not auto-publish'
        );
      }

      const publishGateEnabled = Boolean(config.publishGate?.enabled);
      const threshold = config.publishGate?.confidenceThreshold ?? 0.85;
      const confidence = computePublishConfidence(brief, quality);
      const publishDecision: 'auto' | 'review' =
        quality.valid && (!publishGateEnabled || confidence >= threshold)
          ? 'auto'
          : 'review';

      brief.generationMeta = {
        ...(brief.generationMeta ?? { isFallback: false }),
        publishDecision,
        publishConfidence: confidence,
      };

      return { brief, quality };
    });

    const publishableBriefs = validatedBriefs.filter(v => v.quality.valid);
    const flaggedBriefs = validatedBriefs.filter(v => !v.quality.valid);
    const baseDiagnostics = buildGenerateDiagnostics(validatedBriefs);
    const budgetStop =
      budgetManager && briefs.length < filteredProblems.length
        ? (() => {
          const spent = budgetManager.getSpent();
          let reason: 'budget_usd_exceeded' | 'budget_tokens_exceeded' | 'unknown' = 'unknown';
          if (typeof envConfig.GRAPH_RUN_BUDGET_USD === 'number') {
            if (spent.estimatedCostUsd >= envConfig.GRAPH_RUN_BUDGET_USD) {
              reason = 'budget_usd_exceeded';
            }
          }
          if (reason === 'unknown' && typeof envConfig.GRAPH_RUN_BUDGET_TOKENS === 'number') {
            if (spent.totalTokens >= envConfig.GRAPH_RUN_BUDGET_TOKENS) {
              reason = 'budget_tokens_exceeded';
            }
          }

          return {
            reason,
            requestedBriefCount: filteredProblems.length,
            generatedBriefCount: briefs.length,
            runBudgetUsd: envConfig.GRAPH_RUN_BUDGET_USD,
            runBudgetTokens: envConfig.GRAPH_RUN_BUDGET_TOKENS,
            spentUsd: Number(spent.estimatedCostUsd.toFixed(6)),
            spentTokens: spent.totalTokens,
          };
        })()
        : undefined;

    const publishGateEnabled = Boolean(config.publishGate?.enabled);
    const publishGateThreshold = config.publishGate?.confidenceThreshold ?? 0.85;
    const autoPublishCount = validatedBriefs.filter(v => v.brief.generationMeta?.publishDecision === 'auto').length;
    const needsReviewCount = validatedBriefs.filter(v => v.brief.generationMeta?.publishDecision === 'review').length;

    const diagnostics = {
      ...(budgetStop ? { ...baseDiagnostics, budgetStop } : baseDiagnostics),
      publishGate: {
        enabled: publishGateEnabled,
        confidenceThreshold: publishGateThreshold,
        autoPublishCount,
        needsReviewCount,
      },
    };

    logger.info(
      {
        publishable: publishableBriefs.length,
        flagged: flaggedBriefs.length,
        fallbackCount: diagnostics.fallbackCount,
        budgetStopReason: diagnostics.budgetStop?.reason,
      },
      'Brief quality validation results'
    );

    // Persist generated briefs to database
    try {
      if (briefs.length > 0) {
        await db
          .insert(ideas)
          .values(
            validatedBriefs.map(({ brief }) => {
              const evidence = problemEvidenceMap.get(brief.problemStatement);
              return {
                id: brief.id,
                name: brief.name,
                tagline: brief.tagline,
                priorityScore: String(brief.priorityScore),
                effortEstimate: brief.effortEstimate,
                revenueEstimate: brief.revenueEstimate,
                category: truncateVarchar(brief.keyFeatures?.[0], IDEA_CATEGORY_MAX_LENGTH),
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
                isPublished: brief.generationMeta?.publishDecision === 'auto',
                publishedAt: brief.generationMeta?.publishDecision === 'auto' ? new Date() : null,
                evidenceStrength: evidence?.evidenceMetadata?.tier ?? null,
                briefType: brief.briefType ?? 'full',
                sourceCount: evidence?.evidenceMetadata?.sourceCount ?? null,
                totalEngagement: evidence?.evidenceMetadata?.totalEngagement ?? null,
                platformCount: evidence?.evidenceMetadata?.platformCount ?? null,
                embedding: evidence?.embedding?.length ? evidence.embedding : null,
              };
            }))
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
        diagnostics,
        generationMode: selection.effectiveMode,
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
