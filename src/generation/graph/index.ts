import logger from '../../lib/logger';
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
    'attempt' | 'latestBrief' | 'latestValidation' | 'maxAttempts' | 'failedSections' | 'sectionRetryCounts'
  >,
): Promise<SingleBriefGraphResult> {
  const maxAttempts = Math.max(1, initialState.config.maxAttempts ?? DEFAULT_GRAPH_MAX_ATTEMPTS);

  let state: SingleBriefGraphState = {
    ...initialState,
    maxAttempts,
    attempt: 1,
    latestBrief: null,
    latestValidation: null,
    failedSections: [],
    sectionRetryCounts: createSectionRetryCounter(),
  };

  while (state.attempt <= state.maxAttempts) {
    const previousBrief = state.latestBrief;
    const sectionsToRetry = state.failedSections;

    state = await runGenerateBriefNode(state);

    if (previousBrief && state.latestBrief && sectionsToRetry.length > 0) {
      state = {
        ...state,
        latestBrief: synthesizeBriefForRetry(previousBrief, state.latestBrief, sectionsToRetry),
      };
    }

    state = runEvaluateBriefNode(state);

    if (state.latestBrief && state.latestValidation?.valid) {
      return {
        brief: state.latestBrief,
        attemptsUsed: state.attempt,
        retried: state.attempt > 1,
        passedQuality: true,
        failedSections: [],
        sectionRetryCounts: state.sectionRetryCounts,
        reasons: [],
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
    failedSections: state.failedSections,
    sectionRetryCounts: state.sectionRetryCounts,
    reasons: state.latestValidation?.reasons ?? [],
  };
}
