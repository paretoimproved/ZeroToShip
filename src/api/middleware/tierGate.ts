/**
 * Tier Gate Middleware for IdeaForge API
 *
 * Enforces feature restrictions based on user tier:
 * - Anonymous/Free: Basic idea summaries (3 ideas)
 * - Pro: Full briefs (10 ideas)
 * - Enterprise: All ideas + API access + search + export
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import type { UserTier, IdeaSummary, IdeaBrief } from '../schemas';
import { IDEAS_LIMIT } from './rateLimit';

/**
 * Feature access matrix
 */
export const FEATURE_ACCESS: Record<
  string,
  { minTier: UserTier; description: string }
> = {
  'ideas.today': { minTier: 'anonymous', description: "Get today's ideas" },
  'ideas.detail': { minTier: 'anonymous', description: 'Get idea details' },
  'ideas.archive': { minTier: 'free', description: 'Access idea archive' },
  'ideas.fullBrief': { minTier: 'pro', description: 'View full business briefs' },
  'ideas.search': { minTier: 'enterprise', description: 'Full-text search' },
  'ideas.export': { minTier: 'enterprise', description: 'Export ideas' },
  'validate': { minTier: 'enterprise', description: 'Request idea validation' },
  'user.preferences': { minTier: 'free', description: 'Manage preferences' },
  'user.history': { minTier: 'free', description: 'View history' },
  'user.subscription': { minTier: 'free', description: 'View subscription' },
  'api.keys': { minTier: 'enterprise', description: 'Manage API keys' },
};

/**
 * Tier hierarchy (higher index = higher tier)
 */
const TIER_HIERARCHY: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];

/**
 * Check if user tier has access to a feature
 */
export function hasAccess(userTier: UserTier, feature: string): boolean {
  const featureConfig = FEATURE_ACCESS[feature];
  if (!featureConfig) {
    return false;
  }

  const userTierIndex = TIER_HIERARCHY.indexOf(userTier);
  const requiredTierIndex = TIER_HIERARCHY.indexOf(featureConfig.minTier);

  return userTierIndex >= requiredTierIndex;
}

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
          upgradeUrl: 'https://ideaforge.io/pricing',
        },
      });
    }
  };
}

/**
 * Get the number of ideas a tier can access
 */
export function getIdeasLimit(tier: UserTier): number {
  return IDEAS_LIMIT[tier];
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

/**
 * Check if idea archive access is allowed
 */
export function canAccessArchive(tier: UserTier): boolean {
  return hasAccess(tier, 'ideas.archive');
}

/**
 * Check if full brief access is allowed
 */
export function canAccessFullBrief(tier: UserTier): boolean {
  return hasAccess(tier, 'ideas.fullBrief');
}

/**
 * Check if search is allowed
 */
export function canSearch(tier: UserTier): boolean {
  return hasAccess(tier, 'ideas.search');
}

/**
 * Check if export is allowed
 */
export function canExport(tier: UserTier): boolean {
  return hasAccess(tier, 'ideas.export');
}

/**
 * Get upgrade prompt for a feature
 */
export function getUpgradePrompt(feature: string): {
  message: string;
  requiredTier: UserTier;
  upgradeUrl: string;
} {
  const config = FEATURE_ACCESS[feature];
  if (!config) {
    return {
      message: 'Upgrade to access this feature',
      requiredTier: 'pro',
      upgradeUrl: 'https://ideaforge.io/pricing',
    };
  }

  const tierNames: Record<UserTier, string> = {
    anonymous: 'Free',
    free: 'Free',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return {
    message: `Upgrade to ${tierNames[config.minTier]} to ${config.description.toLowerCase()}`,
    requiredTier: config.minTier,
    upgradeUrl: 'https://ideaforge.io/pricing',
  };
}
