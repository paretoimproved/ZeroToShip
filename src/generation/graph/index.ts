import logger from '../../lib/logger';
import { runEvaluateBriefNode } from './nodes/evaluate-brief';
import { runGenerateBriefNode } from './nodes/generate-brief';
import type { SingleBriefGraphResult, SingleBriefGraphState } from './state';

const DEFAULT_GRAPH_MAX_ATTEMPTS = 2;

export async function runSingleBriefGraph(
  initialState: Omit<SingleBriefGraphState, 'attempt' | 'latestBrief' | 'latestValidation' | 'maxAttempts'>,
): Promise<SingleBriefGraphResult> {
  const maxAttempts = Math.max(1, initialState.config.maxAttempts ?? DEFAULT_GRAPH_MAX_ATTEMPTS);

  let state: SingleBriefGraphState = {
    ...initialState,
    maxAttempts,
    attempt: 1,
    latestBrief: null,
    latestValidation: null,
  };

  while (state.attempt <= state.maxAttempts) {
    state = await runGenerateBriefNode(state);
    state = runEvaluateBriefNode(state);

    if (state.latestBrief && state.latestValidation?.valid) {
      return {
        brief: state.latestBrief,
        attemptsUsed: state.attempt,
        retried: state.attempt > 1,
        passedQuality: true,
      };
    }

    if (state.attempt >= state.maxAttempts) {
      break;
    }

    logger.info(
      {
        problemId: state.problem.id,
        attempt: state.attempt,
        maxAttempts: state.maxAttempts,
        reasons: state.latestValidation?.reasons ?? [],
      },
      'Graph critic requested retry for single brief'
    );

    state = {
      ...state,
      attempt: state.attempt + 1,
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
  };
}
