import logger from '../../lib/logger';
import { buildGraphModelCascade } from './model-cascade';
import { runEvaluateBriefNode } from './nodes/evaluate-brief';
import { runGenerateBriefNode } from './nodes/generate-brief';
import { synthesizeBriefForRetry } from './nodes/synthesize-brief';
import type { GraphSection, SingleBriefGraphResult, SingleBriefGraphState } from './state';

const DEFAULT_GRAPH_MAX_ATTEMPTS = 2;
const ALL_GRAPH_SECTIONS: GraphSection[] = [
  'core',
  'problem',
  'audience',
  'market',
  'solution',
  'features',
  'technical',
  'business_model',
  'gtm',
  'risks',
];

function createSectionRetryCounter(): Record<GraphSection, number> {
  return ALL_GRAPH_SECTIONS.reduce((acc, section) => {
    acc[section] = 0;
    return acc;
  }, {} as Record<GraphSection, number>);
}

export async function runSingleBriefGraph(
  initialState: Omit<
    SingleBriefGraphState,
    | 'attempt'
    | 'latestBrief'
    | 'latestValidation'
    | 'maxAttempts'
    | 'modelCascade'
    | 'modelsUsed'
    | 'lastAttemptModel'
    | 'failedSections'
    | 'sectionRetryCounts'
    | 'trace'
  >,
): Promise<SingleBriefGraphResult> {
  const maxAttempts = Math.max(1, initialState.config.maxAttempts ?? DEFAULT_GRAPH_MAX_ATTEMPTS);
  const modelCascade = buildGraphModelCascade(initialState.config.model);

  let state: SingleBriefGraphState = {
    ...initialState,
    maxAttempts,
    modelCascade,
    modelsUsed: [],
    attempt: 1,
    lastAttemptModel: null,
    latestBrief: null,
    latestValidation: null,
    failedSections: [],
    sectionRetryCounts: createSectionRetryCounter(),
    trace: [],
  };

  while (state.attempt <= state.maxAttempts) {
    const previousBrief = state.latestBrief;
    const sectionsToRetry = state.failedSections;
    const attemptStartedAt = new Date().toISOString();

    state = await runGenerateBriefNode(state);

    if (previousBrief && state.latestBrief && sectionsToRetry.length > 0) {
      state = {
        ...state,
        latestBrief: synthesizeBriefForRetry(previousBrief, state.latestBrief, sectionsToRetry),
      };
    }

    state = runEvaluateBriefNode(state);

    const attemptFinishedAt = new Date().toISOString();
    const traceEntry = {
      attempt: state.attempt,
      model: state.lastAttemptModel,
      retrySections: sectionsToRetry,
      mergedSections: previousBrief && sectionsToRetry.length > 0 ? sectionsToRetry : [],
      passedQuality: Boolean(state.latestValidation?.valid),
      reasons: state.latestValidation?.reasons ?? [],
      failedSections: state.failedSections,
      startedAt: attemptStartedAt,
      finishedAt: attemptFinishedAt,
    };

    state = {
      ...state,
      trace: [...state.trace, traceEntry],
    };

    if (state.latestBrief && state.latestValidation?.valid) {
      return {
        brief: state.latestBrief,
        attemptsUsed: state.attempt,
        retried: state.attempt > 1,
        passedQuality: true,
        modelsUsed: state.modelsUsed,
        failedSections: [],
        sectionRetryCounts: state.sectionRetryCounts,
        reasons: [],
        trace: state.trace,
      };
    }

    if (state.attempt >= state.maxAttempts) {
      break;
    }

    const sectionRetryCounts = { ...state.sectionRetryCounts };
    for (const section of state.failedSections) {
      sectionRetryCounts[section] += 1;
    }

    logger.info(
      {
        problemId: state.problem.id,
        attempt: state.attempt,
        maxAttempts: state.maxAttempts,
        reasons: state.latestValidation?.reasons ?? [],
        failedSections: state.failedSections,
      },
      'Graph critic requested retry for single brief'
    );

    state = {
      ...state,
      attempt: state.attempt + 1,
      sectionRetryCounts,
    };
  }

  if (!state.latestBrief) {
    throw new Error(`Graph generation produced no brief for problem "${state.problem.id}"`);
  }

  return {
    brief: state.latestBrief,
    attemptsUsed: state.attempt,
    retried: state.attempt > 1,
    passedQuality: false,
    modelsUsed: state.modelsUsed,
    failedSections: state.failedSections,
    sectionRetryCounts: state.sectionRetryCounts,
    reasons: state.latestValidation?.reasons ?? [],
    trace: state.trace,
  };
}
