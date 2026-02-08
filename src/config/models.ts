/**
 * AI Model Configuration for IdeaForge
 *
 * Model selection based on subscription tier and task type.
 * See docs/cost-analysis.md for pricing rationale.
 */

/**
 * Anthropic Claude model IDs
 */
export const CLAUDE_MODELS = {
  // Haiku 4.5 - Fast, cost-effective for batch operations
  HAIKU: 'claude-3-5-haiku-latest',

  // Sonnet 4.5 - Balanced quality/cost for Pro briefs
  SONNET: 'claude-sonnet-4-20250514',

  // Opus 4.5 - Highest quality for Enterprise briefs
  OPUS: 'claude-opus-4-5-20251101',
} as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];

/**
 * User subscription tiers
 */
export type UserTier = 'free' | 'pro' | 'enterprise';

/**
 * Get the appropriate model for batch operations
 * All tiers use Haiku for scoring, clustering, competitor analysis
 */
export function getBatchModel(): ClaudeModel {
  return CLAUDE_MODELS.HAIKU;
}

/**
 * Get the appropriate model for brief generation based on tier
 *
 * Free: Haiku (preview quality, cost-effective)
 * Pro: Sonnet (full quality briefs)
 * Enterprise: Opus (premium quality)
 */
export function getBriefModel(tier: UserTier): ClaudeModel {
  switch (tier) {
    case 'enterprise':
      return CLAUDE_MODELS.OPUS;
    case 'pro':
      return CLAUDE_MODELS.SONNET;
    case 'free':
    default:
      return CLAUDE_MODELS.HAIKU;
  }
}

/**
 * Get the model used for pipeline-generated briefs.
 * Always uses Sonnet for quality — pipeline briefs are the core product output.
 */
export function getPipelineBriefModel(): ClaudeModel {
  return CLAUDE_MODELS.SONNET;
}

/**
 * Get model display name for UI
 */
export function getModelDisplayName(model: ClaudeModel): string {
  switch (model) {
    case CLAUDE_MODELS.OPUS:
      return 'Claude Opus 4.5 (Premium)';
    case CLAUDE_MODELS.SONNET:
      return 'Claude Sonnet 4.5';
    case CLAUDE_MODELS.HAIKU:
      return 'Claude Haiku 4.5';
    default:
      return 'Claude';
  }
}

/**
 * Model pricing per 1M tokens (for display/estimation)
 */
export const MODEL_PRICING = {
  [CLAUDE_MODELS.HAIKU]: { input: 1.0, output: 5.0 },
  [CLAUDE_MODELS.SONNET]: { input: 3.0, output: 15.0 },
  [CLAUDE_MODELS.OPUS]: { input: 15.0, output: 75.0 },
} as const;
