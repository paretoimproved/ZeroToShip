/**
 * Tier Configuration Constants for ZeroToShip API
 *
 * Pure configuration - no dependencies on database or external services
 */

/**
 * User tiers
 */
export type UserTier = 'anonymous' | 'free' | 'pro' | 'enterprise';

/** One hour in milliseconds — standard rate limit window */
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Rate limit configuration per tier
 */
export const RATE_LIMITS: Record<UserTier, { requests: number; windowMs: number }> = {
  anonymous: { requests: 10, windowMs: ONE_HOUR_MS },
  free: { requests: 100, windowMs: ONE_HOUR_MS },
  pro: { requests: 1000, windowMs: ONE_HOUR_MS },
  enterprise: { requests: 10000, windowMs: ONE_HOUR_MS },
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
 * Usage limits per tier for API rate limiting
 */
export interface TierUsageLimits {
  requestsPerHour: number;
}

/**
 * Usage limits configuration per tier
 */
export const TIER_USAGE_LIMITS: Record<UserTier, TierUsageLimits> = {
  anonymous: {
    requestsPerHour: 10,
  },
  free: {
    requestsPerHour: 100,
  },
  pro: {
    requestsPerHour: 1000,
  },
  enterprise: {
    requestsPerHour: 10000,
  },
};

/**
 * Feature access matrix
 */
export const FEATURE_ACCESS: Record<string, { minTier: UserTier; description: string }> = {
  'ideas.today': { minTier: 'anonymous', description: "Get today's ideas" },
  'ideas.detail': { minTier: 'anonymous', description: 'Get idea details' },
  'ideas.archive': { minTier: 'pro', description: 'Access idea archive' },
  'ideas.fullBrief': { minTier: 'pro', description: 'View full business briefs' },
  'ideas.search': { minTier: 'pro', description: 'Full-text search' },
  'ideas.export': { minTier: 'enterprise', description: 'Export ideas' },
  'validate': { minTier: 'pro', description: 'Request idea validation' },
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
      upgradeUrl: 'https://zerotoship.dev/pricing',
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
    upgradeUrl: 'https://zerotoship.dev/pricing',
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
