import { generateAllBriefs } from '../../brief-generator';
import type { SingleBriefGraphState } from '../state';

export async function runGenerateBriefNode(state: SingleBriefGraphState): Promise<SingleBriefGraphState> {
  const briefs = await generateAllBriefs(
    [state.problem],
    state.gapAnalyses,
    state.config,
  );

  return {
    ...state,
    latestBrief: briefs[0] ?? null,
  };
}
