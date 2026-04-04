import { validateBriefQuality } from '../../brief-generator';
import type { GraphSection, SingleBriefGraphState } from '../state';

function inferSectionFromReason(reason: string): GraphSection {
  const normalized = reason.toLowerCase();

  if (normalized.includes('name') || normalized.includes('tagline') || normalized.includes('revenueestimate')) {
    return 'core';
  }
  if (normalized.includes('problemstatement')) {
    return 'problem';
  }
  if (normalized.includes('targetaudience')) {
    return 'audience';
  }
  if (normalized.includes('marketsize') || normalized.includes('existingsolutions') || normalized.includes('gaps')) {
    return 'market';
  }
  if (normalized.includes('proposedsolution')) {
    return 'solution';
  }
  if (normalized.includes('keyfeatures') || normalized.includes('mvpscope')) {
    return 'features';
  }
  if (normalized.includes('tech stack') || normalized.includes('technicalspec')) {
    return 'technical';
  }
  if (normalized.includes('pricing') || normalized.includes('revenueprojection') || normalized.includes('monetization')) {
    return 'business_model';
  }
  if (normalized.includes('channels') || normalized.includes('launchstrategy') || normalized.includes('firstcustomers')) {
    return 'gtm';
  }
  if (normalized.includes('risks')) {
    return 'risks';
  }

  return 'core';
}

export function runEvaluateBriefNode(state: SingleBriefGraphState): SingleBriefGraphState {
  if (!state.latestBrief) {
    return {
      ...state,
      latestValidation: {
        valid: false,
        reasons: ['graph_missing_brief'],
        failedSections: ['core'],
      },
      failedSections: ['core'],
    };
  }

  const assessment = validateBriefQuality(state.latestBrief);
  const failedSections = Array.from(new Set(assessment.reasons.map(inferSectionFromReason)));

  return {
    ...state,
    latestValidation: {
      ...assessment,
      failedSections,
    },
    failedSections,
  };
}
