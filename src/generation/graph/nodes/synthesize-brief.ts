import type { IdeaBrief } from '../../brief-generator';
import type { GraphSection } from '../state';

function replaceSection(base: IdeaBrief, candidate: IdeaBrief, section: GraphSection): IdeaBrief {
  switch (section) {
    case 'core':
      return {
        ...base,
        name: candidate.name,
        tagline: candidate.tagline,
        revenueEstimate: candidate.revenueEstimate,
      };
    case 'problem':
      return {
        ...base,
        problemStatement: candidate.problemStatement,
      };
    case 'audience':
      return {
        ...base,
        targetAudience: candidate.targetAudience,
      };
    case 'market':
      return {
        ...base,
        marketSize: candidate.marketSize,
        existingSolutions: candidate.existingSolutions,
        gaps: candidate.gaps,
      };
    case 'solution':
      return {
        ...base,
        proposedSolution: candidate.proposedSolution,
      };
    case 'features':
      return {
        ...base,
        keyFeatures: candidate.keyFeatures,
        mvpScope: candidate.mvpScope,
      };
    case 'technical':
      return {
        ...base,
        technicalSpec: candidate.technicalSpec,
      };
    case 'business_model':
      return {
        ...base,
        businessModel: candidate.businessModel,
      };
    case 'gtm':
      return {
        ...base,
        goToMarket: candidate.goToMarket,
      };
    case 'risks':
      return {
        ...base,
        risks: candidate.risks,
      };
    default:
      return base;
  }
}

export function synthesizeBriefForRetry(
  previous: IdeaBrief,
  candidate: IdeaBrief,
  failedSections: GraphSection[],
): IdeaBrief {
  let merged: IdeaBrief = {
    ...previous,
    generatedAt: candidate.generatedAt,
    generationMeta: candidate.generationMeta ?? previous.generationMeta,
  };

  for (const section of failedSections) {
    merged = replaceSection(merged, candidate, section);
  }

  return merged;
}
