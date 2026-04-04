/**
 * Pain Point Signal Detection for ZeroToShip
 *
 * Detects phrases that indicate pain points, frustrations, and product opportunities
 * in scraped content.
 */

import { normalizeApostrophes } from './shared';

/**
 * Categories of pain point signals with their patterns
 */
export const SIGNAL_PATTERNS = {
  // Wishful thinking - indicates unmet needs
  wishful: [
    'i wish',
    'wish there was',
    'wish there were',
    'wish i had',
    'wish i could',
    'if only there was',
    'if only there were',
    'would be nice if',
    'would be great if',
    'it would be awesome if',
  ],

  // Frustration - indicates pain points
  frustration: [
    'frustrated',
    'frustrating',
    'annoying',
    'annoyed',
    'hate when',
    'hate that',
    'sick of',
    'tired of',
    'fed up with',
    'drives me crazy',
    'pain point',
    'painful',
  ],

  // Questions seeking solutions - indicates gaps
  seeking: [
    "why isn't there",
    "why doesn't",
    "why can't",
    "why is there no",
    'is there a tool',
    'is there an app',
    'is there a way',
    'anyone know of',
    'looking for a tool',
    'looking for an app',
    'looking for a way',
    'need a tool',
    'need an app',
    'need a way to',
  ],

  // Willingness to pay - strong market signal
  willingness: [
    "i'd pay for",
    "i would pay",
    'would pay for',
    'shut up and take my money',
    'take my money',
    'worth paying for',
    'happy to pay',
    'gladly pay',
  ],

  // Feature requests - indicates product gaps
  requests: [
    'feature request',
    'feature idea',
    'suggestion:',
    'idea:',
    'proposal:',
    'enhancement',
    'help wanted',
    'would be nice to have',
    'missing feature',
  ],

  // Problem statements
  problems: [
    'the problem is',
    'my problem is',
    'biggest issue',
    'main issue',
    'the issue is',
    'struggling with',
    'having trouble',
    'can\'t figure out',
    'doesn\'t work well',
    'broken',
  ],
} as const;

/**
 * All signal patterns flattened into a single array
 */
export const ALL_SIGNALS: readonly string[] = Object.values(SIGNAL_PATTERNS).flat();

/**
 * Backward-compatible alias for ALL_SIGNALS.
 * Previously defined separately in types.ts as a smaller subset.
 * Now unified to use the full categorized signal set.
 */
export const PAIN_POINT_SIGNALS: readonly string[] = ALL_SIGNALS;

/**
 * Signal match result with category information
 */
export interface SignalMatch {
  pattern: string;
  category: keyof typeof SIGNAL_PATTERNS;
  index: number;
}

/**
 * Detect all pain point signals in text
 * Returns array of matched signal patterns
 */
export function detectSignals(text: string): string[] {
  if (!text) return [];

  const lowerText = normalizeApostrophes(text.toLowerCase());
  const matches: string[] = [];

  for (const pattern of ALL_SIGNALS) {
    if (lowerText.includes(normalizeApostrophes(pattern.toLowerCase()))) {
      matches.push(pattern);
    }
  }

  return matches;
}

/**
 * Detect signals with category information
 * Returns detailed matches with category and position
 */
export function detectSignalsWithCategory(text: string): SignalMatch[] {
  if (!text) return [];

  const lowerText = normalizeApostrophes(text.toLowerCase());
  const matches: SignalMatch[] = [];

  for (const [category, patterns] of Object.entries(SIGNAL_PATTERNS)) {
    for (const pattern of patterns) {
      const index = lowerText.indexOf(normalizeApostrophes(pattern.toLowerCase()));
      if (index !== -1) {
        matches.push({
          pattern,
          category: category as keyof typeof SIGNAL_PATTERNS,
          index,
        });
      }
    }
  }

  // Sort by position in text
  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Check if text contains any pain point signals
 */
export function hasSignals(text: string): boolean {
  if (!text) return false;

  const lowerText = normalizeApostrophes(text.toLowerCase());
  return ALL_SIGNALS.some(pattern =>
    lowerText.includes(normalizeApostrophes(pattern.toLowerCase()))
  );
}

/**
 * Calculate a signal strength score (0-1)
 * Based on number and type of signals found
 */
export function calculateSignalStrength(text: string): number {
  if (!text) return 0;

  const matches = detectSignalsWithCategory(text);
  if (matches.length === 0) return 0;

  // Weight by category (willingness to pay is strongest signal)
  const weights: Record<keyof typeof SIGNAL_PATTERNS, number> = {
    willingness: 1.0,
    frustration: 0.8,
    seeking: 0.7,
    wishful: 0.6,
    problems: 0.5,
    requests: 0.4,
  };

  const categories = new Set(matches.map(m => m.category));
  let totalWeight = 0;

  for (const category of categories) {
    totalWeight += weights[category];
  }

  // Normalize to 0-1 range (max would be ~4.0 if all categories matched)
  return Math.min(totalWeight / 3.0, 1.0);
}

/**
 * Extract context around signal matches
 * Useful for displaying relevant snippets
 */
export function extractSignalContext(
  text: string,
  contextChars: number = 100
): Array<{ signal: string; context: string }> {
  if (!text) return [];

  const lowerText = normalizeApostrophes(text.toLowerCase());
  const results: Array<{ signal: string; context: string }> = [];

  for (const pattern of ALL_SIGNALS) {
    const index = lowerText.indexOf(normalizeApostrophes(pattern.toLowerCase()));
    if (index !== -1) {
      const start = Math.max(0, index - contextChars);
      const end = Math.min(text.length, index + pattern.length + contextChars);
      const context = text.slice(start, end).trim();

      results.push({
        signal: pattern,
        context: (start > 0 ? '...' : '') + context + (end < text.length ? '...' : ''),
      });
    }
  }

  return results;
}
