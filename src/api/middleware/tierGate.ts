/**
 * Tier Gate Middleware for ZeroToShip API
 *
 * Enforces feature restrictions based on user tier:
 * - Anonymous/Free: Basic idea summaries (3 ideas)
 * - Pro: Full briefs (10 ideas)
 * - Enterprise: All ideas + API access + search + export
 *
 * Feature access rules, tier hierarchy, and helper functions are defined in
 * src/api/config/tiers.ts (single source of truth) and re-exported here
 * for convenience.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import type { UserTier, IdeaSummary, IdeaBrief } from '../schemas';
import {
  FEATURE_ACCESS,
  hasAccess,
  getIdeasLimit,
  canAccessArchive,
  canAccessFullBrief,
  canSearch,
  canExport,
  getUpgradePrompt,
} from '../config/tiers';

// Re-export tier helpers so existing consumers don't need to change imports
export {
  FEATURE_ACCESS,
  hasAccess,
  getIdeasLimit,
  canAccessArchive,
  canAccessFullBrief,
  canSearch,
  canExport,
  getUpgradePrompt,
};

/**
 * Create tier gate middleware for a specific feature
 */
export function createTierGate(feature: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!hasAccess(request.userTier, feature)) {
      const featureConfig = FEATURE_ACCESS[feature];
      reply.status(403).send({
        code: 'TIER_RESTRICTED',
        message: `This feature requires ${featureConfig?.minTier || 'a higher'} tier or above`,
        details: {
          feature,
          requiredTier: featureConfig?.minTier,
          currentTier: request.userTier,
          upgradeUrl: 'https://zerotoship.dev/pricing',
        },
      });
    }
  };
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
    revenueEstimate: idea.revenueEstimate,
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
