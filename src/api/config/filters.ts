/**
 * Tier-based filtering functions for IdeaForge API
 *
 * Pure functions - no database dependencies
 */

import type { UserTier } from './tiers';
import { getIdeasLimit } from './tiers';

/**
 * Idea summary type (minimal version for filtering)
 */
export interface IdeaSummary {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: string;
  category?: string;
  generatedAt: string;
  brief?: IdeaBrief;
}

/**
 * Full idea brief type
 */
export interface IdeaBrief {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: string;
  revenueEstimate?: string;
  category?: string;

  problemStatement: string;
  targetAudience?: string;
  marketSize?: string;

  existingSolutions?: string;
  gaps?: string;

  proposedSolution?: string;
  keyFeatures?: string[];
  mvpScope?: string;

  technicalSpec?: {
    stack: string[];
    architecture: string;
    estimatedEffort: string;
  };

  businessModel?: {
    pricing: string;
    revenueProjection: string;
    monetizationPath: string;
  };

  goToMarket?: {
    launchStrategy: string;
    channels: string[];
    firstCustomers: string;
  };

  risks?: string[];
  generatedAt: string;
}

/**
 * Strip sensitive fields from ideas based on tier
 */
export function filterIdeaForTier(idea: IdeaBrief, tier: UserTier): IdeaSummary {
  // Base summary available to all tiers
  const summary: IdeaSummary = {
    id: idea.id,
    name: idea.name,
    tagline: idea.tagline,
    priorityScore: idea.priorityScore,
    effortEstimate: idea.effortEstimate,
    category: idea.category,
    generatedAt: idea.generatedAt,
  };

  // Pro and Enterprise get full briefs
  if (tier === 'pro' || tier === 'enterprise') {
    summary.brief = idea;
  }

  return summary;
}

/**
 * Filter array of ideas based on tier limits
 */
export function filterIdeasForTier(
  ideas: IdeaBrief[],
  tier: UserTier
): { ideas: IdeaSummary[]; total: number; limited: boolean } {
  const limit = getIdeasLimit(tier);
  const total = ideas.length;
  const limited = total > limit;

  // Slice to tier limit
  const sliced = limited && limit !== Infinity ? ideas.slice(0, limit) : ideas;

  // Convert to summaries with appropriate detail level
  const filtered = sliced.map((idea) => filterIdeaForTier(idea, tier));

  return { ideas: filtered, total, limited };
}
