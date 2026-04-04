/**
 * Shared JSON extraction utility for parsing AI/LLM responses.
 *
 * Handles markdown code fences, surrounding prose text, and
 * truncated JSON recovery (unclosed brackets/braces).
 */

import logger from './logger';

/**
 * Strip markdown code fences from a string.
 */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Attempt to recover truncated JSON by closing unclosed brackets/braces.
 * Returns the fixed string if structural repairs were needed, null otherwise.
 */
function recoverTruncatedJson(text: string): string | null {
  let cleaned = text.replace(/,\s*$/, '');

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of cleaned) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  if (openBraces === 0 && openBrackets === 0 && !inString) {
    return null; // No structural fixes needed
  }

  if (inString) cleaned += '"';
  for (let i = 0; i < openBraces; i++) cleaned += '}';
  for (let i = 0; i < openBrackets; i++) cleaned += ']';

  logger.info(
    { fixedBraces: openBraces, fixedBrackets: openBrackets },
    'Recovered truncated JSON response'
  );
  return cleaned;
}

/**
 * Extract and parse JSON from an AI response string.
 *
 * Handles three common scenarios:
 * 1. Response is pure JSON (possibly wrapped in markdown code fences)
 * 2. Response contains JSON embedded in prose text
 * 3. JSON is truncated (unclosed brackets/braces)
 *
 * @returns The parsed object, or null if extraction fails.
 */
export function extractJson<T>(response: string): T | null {
  // Step 1: Try direct parse after stripping code fences
  const stripped = stripCodeFences(response);
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Continue to regex extraction
  }

  // Step 2: Try truncation recovery on stripped text
  const recovered = recoverTruncatedJson(stripped);
  if (recovered) {
    try {
      return JSON.parse(recovered) as T;
    } catch {
      // Continue to regex extraction
    }
  }

  // Step 3: Try regex extraction for JSON embedded in prose
  const objectMatch = response.match(/\{[\s\S]*\}/);
  const arrayMatch = response.match(/\[[\s\S]*\]/);

  // Pick the match that starts earliest in the response
  const match =
    objectMatch && arrayMatch
      ? objectMatch.index! <= arrayMatch.index!
        ? objectMatch
        : arrayMatch
      : objectMatch || arrayMatch;

  if (match) {
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      // Fall through
    }
  }

  logger.warn(
    { rawResponse: response.slice(0, 200) },
    'Failed to extract JSON from response'
  );
  return null;
}

/**
 * Extract a JSON array from an AI response string.
 * Convenience wrapper that ensures the result is an array.
 */
export function extractJsonArray<T>(response: string): T[] | null {
  const result = extractJson<T[]>(response);
  if (result && !Array.isArray(result)) {
    logger.warn('Expected JSON array but got object');
    return null;
  }
  return result;
}
