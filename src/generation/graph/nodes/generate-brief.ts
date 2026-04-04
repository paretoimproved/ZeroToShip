import { generateAllBriefs } from '../../brief-generator';
import { getAttemptModel } from '../model-cascade';
import type { SingleBriefGraphState } from '../state';
import { mergeGapEnrichment, buildSkippedHandoffMeta } from '../../handoff/enrich-gap-analysis';
import { requestGapEnrichmentFromN8n } from '../../handoff/n8n-client';
import { requestGapEnrichmentMock } from '../../handoff/mock';

export async function runGenerateBriefNode(state: SingleBriefGraphState): Promise<SingleBriefGraphState> {
  const provider = state.config.handoffProvider ?? 'off';
  const maxFailures = Math.max(0, state.config.handoffMaxFailures ?? 2);
  const shouldTryHandoff =
    provider !== 'off' &&
    !state.handoffApplied &&
    state.handoffFailureCount <= maxFailures &&
    (state.attempt === 1 || state.failedSections.includes('market'));

  if (shouldTryHandoff) {
    const gap = state.gapAnalyses.get(state.problem.id);
    if (!gap) {
      state = {
        ...state,
        handoffApplied: true,
        handoffMeta: buildSkippedHandoffMeta(provider, 'missing_gap_analysis'),
      };
    } else if (provider === 'n8n' && !state.config.handoffUrl) {
      state = {
        ...state,
        handoffApplied: true,
        handoffMeta: buildSkippedHandoffMeta(provider, 'missing_handoff_url'),
      };
    } else {
      const req = {
        type: 'gap_enrichment_v1' as const,
        problemId: state.problem.id,
        problemStatement: state.problem.problemStatement,
        existingSolutions: gap.existingSolutions,
        gaps: gap.gaps,
        differentiationAngles: gap.differentiationAngles,
      };

      const result = provider === 'mock'
        ? await requestGapEnrichmentMock(req)
        : await requestGapEnrichmentFromN8n(
          {
            url: state.config.handoffUrl!,
            apiKey: state.config.handoffApiKey || undefined,
            timeoutMs: Math.max(1, state.config.handoffTimeoutMs ?? 8000),
          },
          req,
        );

      if (result.ok && result.response?.ok) {
        const { merged, meta } = mergeGapEnrichment(gap, result.response.payload);
        const gapAnalyses = new Map(state.gapAnalyses);
        gapAnalyses.set(state.problem.id, merged);

        state = {
          ...state,
          gapAnalyses,
          handoffApplied: true,
          handoffMeta: {
            provider,
            status: 'ok',
            durationMs: result.durationMs,
            ...meta,
          },
        };
      } else {
        const nextFailureCount = state.handoffFailureCount + 1;
        const errorReason =
          (typeof (result as { error?: string }).error === 'string' ? (result as { error?: string }).error : undefined)
          || result.response?.error
          || 'handoff_error';
        const handoffMeta = {
          provider,
          status: 'error' as const,
          durationMs: result.durationMs,
          reason: errorReason,
        };

        state = {
          ...state,
          handoffFailureCount: nextFailureCount,
          handoffApplied: nextFailureCount >= maxFailures,
          handoffMeta,
        };
      }
    }
  }

  const modelForAttempt = getAttemptModel(state.modelCascade, state.attempt);
  const modelOverride = modelForAttempt ?? (state.config.model || undefined);
  const briefs = await generateAllBriefs(
    [state.problem],
    state.gapAnalyses,
    {
      ...state.config,
      model: modelOverride,
    },
  );

  const modelsUsed = modelForAttempt
    ? [...state.modelsUsed, modelForAttempt]
    : state.modelsUsed;

  return {
    ...state,
    modelsUsed,
    lastAttemptModel: modelOverride ?? null,
    latestBrief: briefs[0] ?? null,
  };
}
