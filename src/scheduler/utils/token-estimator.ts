/**
 * Token Estimation Utilities for IdeaForge
 *
 * Provides rough token count estimates for cost calculation.
 * Uses ~4 chars per token approximation for English text.
 */

/**
 * Estimate tokens from text
 * Rough approximation: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens from a structured prompt
 */
export function estimatePromptTokens(prompt: {
  system?: string;
  messages: Array<{ content: string }>;
}): number {
  let total = 0;
  if (prompt.system) total += estimateTokens(prompt.system);
  for (const msg of prompt.messages) {
    total += estimateTokens(msg.content);
  }
  return total;
}

/**
 * Estimate tokens for a JSON object (serialized)
 */
export function estimateJsonTokens(obj: unknown): number {
  try {
    const json = JSON.stringify(obj);
    return estimateTokens(json);
  } catch {
    return 0;
  }
}
