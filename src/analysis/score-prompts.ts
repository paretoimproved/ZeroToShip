/**
 * AI Prompt Templates for Problem Scoring
 *
 * Provides structured prompts for GPT-4 to assess problem severity,
 * market size, and technical complexity.
 */

import type { ProblemCluster } from './deduplicator';
import type { RawPost } from '../scrapers/types';
import logger from '../lib/logger';

/**
 * Response format expected from the AI scoring
 */
export interface ScoreResponse {
  severity: {
    score: number;
    reasoning: string;
  };
  marketSize: {
    score: number;
    reasoning: string;
  };
  technicalComplexity: {
    score: number;
    reasoning: string;
  };
  timeToMvp: {
    score: number;
    reasoning: string;
  };
}

/**
 * Format sample posts for the prompt
 */
function formatSamplePosts(posts: RawPost[], maxPosts: number = 3): string {
  return posts
    .slice(0, maxPosts)
    .map((post, i) => {
      const body = post.body ? `: "${post.body.slice(0, 150)}..."` : '';
      return `${i + 1}. [${post.source}] "${post.title}"${body}`;
    })
    .join('\n');
}

/**
 * Build the scoring prompt for a problem cluster
 */
export function buildScoringPrompt(cluster: ProblemCluster): string {
  const allPosts = [cluster.representativePost, ...cluster.relatedPosts];
  const samplePosts = formatSamplePosts(allPosts);
  const sourceList = cluster.sources.join(', ');

  const avgEngagement = cluster.frequency > 0 ? (cluster.totalScore / cluster.frequency).toFixed(1) : '0';

  return `Analyze this problem and provide scores.

Problem: "${cluster.problemStatement}"
Mentioned ${cluster.frequency} times across ${sourceList}
Total engagement score: ${cluster.totalScore}
Average engagement per post: ${avgEngagement}

Sample posts:
${samplePosts}

Score each dimension from 1-10 with brief reasoning:

1. **Severity**: How painful is this problem for users?
   - 1-3: Minor inconvenience, workaround exists
   - 4-6: Moderate pain, causes lost time/money
   - 7-10: Critical pain, major blocker

2. **Market Size**: How many people/businesses have this problem?
   - 1-3: Niche (<10K potential users)
   - 4-6: Medium market (10K-1M potential users)
   - 7-10: Large market (>1M potential users)

3. **Technical Complexity**: How hard is it to build a solution?
   - 1-3: Simple, existing APIs/tools available
   - 4-6: Moderate, some custom development needed
   - 7-10: Complex, requires significant R&D

4. **Time to MVP**: How long to build a minimal viable product?
   - 1-2: Weekend project
   - 3-4: One week
   - 5-7: One month
   - 8-10: One quarter or more

Respond in this exact JSON format:
{
  "severity": { "score": <1-10>, "reasoning": "<brief explanation>" },
  "marketSize": { "score": <1-10>, "reasoning": "<brief explanation>" },
  "technicalComplexity": { "score": <1-10>, "reasoning": "<brief explanation>" },
  "timeToMvp": { "score": <1-10>, "reasoning": "<brief explanation>" }
}`;
}

/**
 * System prompt for consistent AI behavior
 */
export const SCORING_SYSTEM_PROMPT = `You are an expert startup advisor analyzing pain points for potential business opportunities.

Your job is to objectively score problems based on:
- Real-world impact on users
- Market opportunity size
- Technical feasibility
- Time to build an MVP

Use the FULL 1-10 range. Do not cluster scores in the 4-6 range.

## Engagement Calibration

The "totalScore" and "Average engagement per post" values reflect real community upvotes/reactions. Use them to distinguish validated pain from keyword noise:

- Average engagement <3: Low validation. Posts may just mention a keyword without expressing real pain. Score severity conservatively (1-4) unless the post text clearly describes acute suffering.
- Average engagement 3-20: Moderate validation. Some community agreement that this is a real problem. Severity 4-7 is typical.
- Average engagement 20-100: Strong validation. Meaningful community resonance. Severity 7+ is warranted if the problem text confirms real pain.
- Average engagement 100+: Exceptional validation. Widespread agreement. Severity 8-10 is appropriate for genuine blockers.

Many mentions of a keyword (high frequency) with low engagement is NOISE, not signal. Fewer mentions with high engagement is a stronger indicator of a real, validated problem.

Score anchors:
- 1-2: Trivial — cosmetic issue, <1K affected users, trivial to build, afternoon project
- 3-4: Minor — small inconvenience, <10K affected, straightforward build, weekend project
- 5-6: Moderate — noticeable pain, 10K-100K affected, some complexity, 1-2 week build
- 7-8: Significant — substantial pain, 100K-1M affected, meaningful engineering, 1-2 month build
- 9-10: Critical — severe blocker, >1M affected, major technical challenge, 3+ month build

## Content Relevance Filter

This platform identifies **technical problems solvable with software**. If a problem is primarily about any of the following, score severity as 1-2 regardless of engagement:

- Career complaints (job searching, salary, promotions, interviews)
- Workplace drama (bad managers, toxic culture, office politics)
- Personal/emotional issues (burnout, imposter syndrome, anxiety)
- Industry pessimism (tech bubble, AI replacing developers, market doom)
- Lifestyle/work-life balance discussions

Only score severity 3+ for problems where a **technical product, tool, or service** could meaningfully address the pain. The question to ask: "Could a startup build software to solve this?" If not, severity 1-2.

Be realistic and consistent in your scoring. Provide brief but insightful reasoning.
Always respond with valid JSON matching the requested format.`;

/**
 * Parse the AI response into a structured ScoreResponse
 */
export function parseScoreResponse(response: string): ScoreResponse | null {
  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('No JSON found in response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    const required = ['severity', 'marketSize', 'technicalComplexity', 'timeToMvp'];
    for (const field of required) {
      if (!parsed[field] || typeof parsed[field].score !== 'number') {
        logger.warn({ field }, 'Missing or invalid field');
        return null;
      }
      // Clamp scores to valid range
      parsed[field].score = Math.max(1, Math.min(10, Math.round(parsed[field].score)));
      parsed[field].reasoning = parsed[field].reasoning || '';
    }

    return parsed as ScoreResponse;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to parse score response');
    return null;
  }
}

/**
 * System prompt for batch scoring multiple problems at once
 */
export const BATCH_SCORING_SYSTEM_PROMPT = `You are an expert startup advisor analyzing pain points for potential business opportunities.

Your job is to objectively score MULTIPLE problems based on:
- Real-world impact on users
- Market opportunity size
- Technical feasibility
- Time to build an MVP

Use the FULL 1-10 range. Do not cluster scores in the 4-6 range.

## Engagement Calibration

The "Engagement" and "Avg engagement" values reflect real community upvotes/reactions. Use them to distinguish validated pain from keyword noise:

- Average engagement <3: Low validation. Posts may just mention a keyword without expressing real pain. Score severity conservatively (1-4) unless the post text clearly describes acute suffering.
- Average engagement 3-20: Moderate validation. Some community agreement that this is a real problem. Severity 4-7 is typical.
- Average engagement 20-100: Strong validation. Meaningful community resonance. Severity 7+ is warranted if the problem text confirms real pain.
- Average engagement 100+: Exceptional validation. Widespread agreement. Severity 8-10 is appropriate for genuine blockers.

Many mentions of a keyword (high frequency) with low engagement is NOISE, not signal. Fewer mentions with high engagement is a stronger indicator of a real, validated problem.

Score anchors:
- 1-2: Trivial — cosmetic issue, <1K affected users, trivial to build, afternoon project
- 3-4: Minor — small inconvenience, <10K affected, straightforward build, weekend project
- 5-6: Moderate — noticeable pain, 10K-100K affected, some complexity, 1-2 week build
- 7-8: Significant — substantial pain, 100K-1M affected, meaningful engineering, 1-2 month build
- 9-10: Critical — severe blocker, >1M affected, major technical challenge, 3+ month build

## Content Relevance Filter

This platform identifies **technical problems solvable with software**. If a problem is primarily about any of the following, score severity as 1-2 regardless of engagement:

- Career complaints (job searching, salary, promotions, interviews)
- Workplace drama (bad managers, toxic culture, office politics)
- Personal/emotional issues (burnout, imposter syndrome, anxiety)
- Industry pessimism (tech bubble, AI replacing developers, market doom)
- Lifestyle/work-life balance discussions

Only score severity 3+ for problems where a **technical product, tool, or service** could meaningfully address the pain. The question to ask: "Could a startup build software to solve this?" If not, severity 1-2.

Be realistic and consistent in your scoring. Provide brief but insightful reasoning.
You will receive multiple problems to score in one request. Score each one independently.
Always respond with valid JSON array matching the requested format.`;

/**
 * Build a prompt that scores multiple problems at once
 * @param clusters - Array of up to 20 problem clusters
 * @returns Prompt string for batch scoring
 */
export function buildBatchScoringPrompt(clusters: ProblemCluster[]): string {
  const problemsList = clusters.map((c, i) => {
    const allPosts = [c.representativePost, ...c.relatedPosts];
    const samplePost = allPosts[0];
    const postPreview = samplePost.body
      ? `"${samplePost.body.slice(0, 100)}..."`
      : `"${samplePost.title}"`;

    const avgEngagement = c.frequency > 0 ? (c.totalScore / c.frequency).toFixed(1) : '0';

    return `## Problem ${i + 1} (ID: ${c.id})
Statement: ${c.problemStatement}
Frequency: ${c.frequency} mentions
Sources: ${c.sources.join(', ')}
Engagement: ${c.totalScore}
Avg engagement: ${avgEngagement}
Representative post: ${postPreview}`;
  }).join('\n\n---\n\n');

  return `Score the following ${clusters.length} startup problems on these dimensions (1-10 scale):

**Scoring Guide:**
- severity (1-10): How painful is this problem? (1-3: minor, 4-6: moderate, 7-10: critical)
- marketSize (1-10): How large is the potential market? (1-3: niche, 4-6: medium, 7-10: large)
- technicalComplexity (1-10): How hard to build a solution? (1-3: simple, 4-6: moderate, 7-10: complex)
- timeToMvp (1-10): How long to build an MVP? (1-2: weekend, 3-4: week, 5-7: month, 8-10: quarter+)

${problemsList}

Respond with a JSON array in this exact format (one object per problem, in order):
[
  {
    "id": "problem_id_here",
    "severity": { "score": 7, "reasoning": "brief explanation" },
    "marketSize": { "score": 8, "reasoning": "brief explanation" },
    "technicalComplexity": { "score": 4, "reasoning": "brief explanation" },
    "timeToMvp": { "score": 3, "reasoning": "brief explanation" }
  }
]`;
}

/**
 * Response format for a single problem in a batch
 */
export interface BatchScoreItem {
  id: string;
  severity: { score: number; reasoning: string };
  marketSize: { score: number; reasoning: string };
  technicalComplexity: { score: number; reasoning: string };
  timeToMvp: { score: number; reasoning: string };
}

/**
 * Parse batch scoring response into a Map of cluster ID to scores
 * @param content - Raw response content from AI
 * @param clusterIds - Expected cluster IDs (for validation)
 * @returns Map of cluster ID to ScoreResponse
 */
export function parseBatchScoreResponse(
  content: string,
  clusterIds: string[]
): Map<string, ScoreResponse> {
  const results = new Map<string, ScoreResponse>();

  try {
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('No JSON array found in batch response');
      return results;
    }

    const parsed = JSON.parse(jsonMatch[0]) as BatchScoreItem[];

    if (!Array.isArray(parsed)) {
      logger.warn('Batch response is not an array');
      return results;
    }

    // Process each item in the response
    for (const item of parsed) {
      if (!item.id) {
        logger.warn('Batch item missing id field');
        continue;
      }

      // Validate and normalize the score response
      const required = ['severity', 'marketSize', 'technicalComplexity', 'timeToMvp'] as const;
      let isValid = true;

      for (const field of required) {
        if (!item[field] || typeof item[field].score !== 'number') {
          logger.warn({ itemId: item.id, field }, 'Batch item missing or invalid field');
          isValid = false;
          break;
        }
        // Clamp scores to valid range
        item[field].score = Math.max(1, Math.min(10, Math.round(item[field].score)));
        item[field].reasoning = item[field].reasoning || '';
      }

      if (isValid) {
        results.set(item.id, {
          severity: item.severity,
          marketSize: item.marketSize,
          technicalComplexity: item.technicalComplexity,
          timeToMvp: item.timeToMvp,
        });
      }
    }

    // Log if we got fewer results than expected
    if (results.size < clusterIds.length) {
      logger.warn({ valid: results.size, expected: clusterIds.length }, 'Batch response had fewer valid scores than expected');
    }

    return results;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to parse batch score response');
    return results;
  }
}

/**
 * Create default scores when AI scoring fails
 */
export function createDefaultScores(cluster: ProblemCluster): ScoreResponse {
  // Use heuristics based on available data
  const frequencyScore = Math.min(10, Math.max(1, Math.ceil(cluster.frequency / 3)));
  const engagementScore = Math.min(10, Math.max(1, Math.ceil(Math.log10(cluster.totalScore + 1) * 2)));
  const sourceBonus = cluster.sources.length > 2 ? 1 : 0;

  // Dampen severity when avg engagement is very low (< 3 per post)
  const avgEngagement = cluster.frequency > 0 ? cluster.totalScore / cluster.frequency : 0;
  const engagementDamper = avgEngagement < 3 ? 0.8 : 1.0;

  const rawSeverity = Math.min(10, frequencyScore + sourceBonus);
  const dampenedSeverity = Math.max(1, Math.round(rawSeverity * engagementDamper));

  return {
    severity: {
      score: dampenedSeverity,
      reasoning: `Based on frequency of ${cluster.frequency} mentions (avg engagement: ${avgEngagement.toFixed(1)})`,
    },
    marketSize: {
      score: Math.min(10, engagementScore + sourceBonus),
      reasoning: `Based on engagement score of ${cluster.totalScore}`,
    },
    technicalComplexity: {
      score: 5,
      reasoning: 'Default medium complexity (AI scoring unavailable)',
    },
    timeToMvp: {
      score: 5,
      reasoning: 'Default medium timeline (AI scoring unavailable)',
    },
  };
}
