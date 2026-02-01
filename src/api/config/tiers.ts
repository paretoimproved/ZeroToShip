/**
 * Tier Configuration Constants for IdeaForge API
 *
 * Pure configuration - no dependencies on database or external services
 */

/**
 * User tiers
 */
export type UserTier = 'anonymous' | 'free' | 'pro' | 'enterprise';

/**
 * Rate limit configuration per tier
 */
export const RATE_LIMITS: Record<UserTier, { requests: number; windowMs: number }> = {
  anonymous: { requests: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  free: { requests: 100, windowMs: 60 * 60 * 1000 }, // 100/hour
  pro: { requests: 1000, windowMs: 60 * 60 * 1000 }, // 1000/hour
  enterprise: { requests: 10000, windowMs: 60 * 60 * 1000 }, // 10000/hour
};

/**
 * Ideas returned per tier
 */
export const IDEAS_LIMIT: Record<UserTier, number> = {
  anonymous: 3,
  free: 3,
  pro: 10,
  enterprise: Infinity,
};

/**
 * Feature access matrix
 */
export const FEATURE_ACCESS: Record<string, { minTier: UserTier; description: string }> = {
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
export const TIER_HIERARCHY: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];

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
 * Get the number of ideas a tier can access
 */
export function getIdeasLimit(tier: UserTier): number {
  return IDEAS_LIMIT[tier];
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

/**
 * Effort levels for ideas
 */
export type EffortLevel = 'weekend' | 'week' | 'month' | 'quarter';

/**
 * Email frequency options
 */
export type EmailFrequency = 'daily' | 'weekly' | 'never';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due';
