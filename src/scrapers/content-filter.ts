/**
 * Non-technical content filter for ZeroToShip
 *
 * Detects career complaints, workplace drama, personal anxiety,
 * and industry pessimism that don't represent technical problems
 * solvable with software.
 *
 * Applied in scrapers before posts enter the pipeline to avoid
 * wasting embedding, clustering, and AI scoring on noise.
 */

export const NON_TECHNICAL_PATTERNS = {
  // Career & job market
  career: [
    'job search', 'job hunting', 'job market', 'job offer',
    'looking for a job', 'applying for jobs', 'got laid off', 'laid off',
    'hiring freeze', 'my resume', 'resume tips', 'resume review',
    'cover letter', 'career advice',
    'career change', 'career path', 'career switch', 'career transition',
    'interview prep', 'interview tips', 'coding interview',
    'leetcode', 'whiteboard interview',
    'years of experience', 'yoe',
  ],

  // Compensation & money anxiety
  compensation: [
    'salary negotiation', 'salary expectation', 'salary range',
    'total comp', 'compensation package', 'stock options vest',
    'underpaid', 'pay cut', 'pay raise', 'asking for a raise',
    'cost of living',
  ],

  // Workplace drama & management
  workplace: [
    'toxic workplace', 'toxic manager', 'toxic culture',
    'bad manager', 'bad boss', 'terrible manager',
    'micromanag', 'office politics', 'hostile work environment',
    'hr complaint', 'should i quit', 'thinking of quitting',
    'two weeks notice', 'quiet quitting', 'return to office',
    'rto mandate',
  ],

  // Personal/emotional (not technical)
  personal: [
    'imposter syndrome', 'impostor syndrome',
    'feeling like a fraud',
    'career anxiety', 'job anxiety',
    'work life balance', 'work-life balance',
    'mental health', 'therapy',
    'burnout', 'burned out', 'burnt out',
  ],

  // Industry pessimism / doom
  pessimism: [
    'tech is dead', 'tech bubble', 'market crash',
    'ai replacing', 'ai taking jobs', 'ai will replace',
    'developers are doomed', 'programming is dead',
    'oversaturated market', 'too many developers',
    'junior devs can\'t find', 'no one is hiring',
    'mass layoffs',
  ],
} as const;

/**
 * All patterns flattened for matching
 */
const ALL_PATTERNS: string[] = Object.values(NON_TECHNICAL_PATTERNS).flat();

/**
 * Detect which non-technical patterns are present in text.
 * Useful for logging and debugging.
 *
 * @param text - Text to scan for non-technical signals
 * @returns Array of matched pattern strings
 */
export function detectNonTechnicalSignals(text: string): string[] {
  if (!text) return [];

  const lower = text.toLowerCase();
  return ALL_PATTERNS.filter(pattern => lower.includes(pattern));
}

/**
 * Check whether a post is non-technical content that should be filtered.
 *
 * Returns true if the combined title + body matches any non-technical pattern.
 * When true, the post should be dropped from the pipeline.
 *
 * @param title - Post title
 * @param body - Post body text
 * @returns true if the post is non-technical and should be filtered out
 */
export function isNonTechnicalContent(title: string, body: string): boolean {
  const combined = `${title} ${body}`;
  return detectNonTechnicalSignals(combined).length > 0;
}
