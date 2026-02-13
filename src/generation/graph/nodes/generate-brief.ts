import { generateAllBriefs } from '../../brief-generator';
import { getAttemptModel } from '../model-cascade';
import type { SingleBriefGraphState } from '../state';

export async function runGenerateBriefNode(state: SingleBriefGraphState): Promise<SingleBriefGraphState> {
  const modelForAttempt = getAttemptModel(state.modelCascade, state.attempt);
  const briefs = await generateAllBriefs(
    [state.problem],
    state.gapAnalyses,
    {
      ...state.config,
      model: modelForAttempt ?? state.config.model,
    },
  );

  const modelsUsed = modelForAttempt
    ? [...state.modelsUsed, modelForAttempt]
    : state.modelsUsed;

  return {
    ...state,
    modelsUsed,
    latestBrief: briefs[0] ?? null,
  };
}
