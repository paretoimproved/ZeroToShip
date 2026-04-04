/**
 * Middleware exports for ZeroToShip API
 */

export {
  optionalAuth,
  requireAuth,
  requireEnterprise,
  requirePro,
  authPlugin,
  generateApiKey,
  createApiKeyForUser,
  invalidateTierCache,
} from './auth';

export {
  rateLimitMiddleware,
  getRateLimitStatus,
  clearRateLimit,
  cleanupExpiredRateLimits,
  RATE_LIMITS,
  IDEAS_LIMIT,
} from './rateLimit';

export {
  createTierGate,
  hasAccess,
  getIdeasLimit,
  filterIdeaForTier,
  filterIdeasForTier,
  canAccessArchive,
  canAccessFullBrief,
  canSearch,
  canExport,
  getUpgradePrompt,
  FEATURE_ACCESS,
} from './tierGate';
