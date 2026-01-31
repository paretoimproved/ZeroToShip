/**
 * AI Prompt Templates for Problem Scoring
 *
 * Provides structured prompts for GPT-4 to assess problem severity,
 * market size, and technical complexity.
 */

import type { ProblemCluster } from './deduplicator';
import type { RawPost } from '../scrapers/types';

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

  return `Analyze this problem and provide scores.

Problem: "${cluster.problemStatement}"
Mentioned ${cluster.frequency} times across ${sourceList}
Total engagement score: ${cluster.totalScore}

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
      console.warn('No JSON found in response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    const required = ['severity', 'marketSize', 'technicalComplexity', 'timeToMvp'];
    for (const field of required) {
      if (!parsed[field] || typeof parsed[field].score !== 'number') {
        console.warn(`Missing or invalid field: ${field}`);
        return null;
      }
      // Clamp scores to valid range
      parsed[field].score = Math.max(1, Math.min(10, Math.round(parsed[field].score)));
      parsed[field].reasoning = parsed[field].reasoning || '';
    }

    return parsed as ScoreResponse;
  } catch (error) {
    console.warn('Failed to parse score response:', error);
    return null;
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

  return {
    severity: {
      score: Math.min(10, frequencyScore + sourceBonus),
      reasoning: `Based on frequency of ${cluster.frequency} mentions`,
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
