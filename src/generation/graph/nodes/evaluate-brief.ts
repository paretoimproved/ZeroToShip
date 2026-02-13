import { validateBriefQuality } from '../../brief-generator';
import type { SingleBriefGraphState } from '../state';

export function runEvaluateBriefNode(state: SingleBriefGraphState): SingleBriefGraphState {
  if (!state.latestBrief) {
    return {
      ...state,
      latestValidation: { valid: false, reasons: ['graph_missing_brief'] },
    };
  }

  return {
    ...state,
    latestValidation: validateBriefQuality(state.latestBrief),
  };
}
