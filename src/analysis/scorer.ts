/**
 * Problem Scorer for IdeaForge
 *
 * Scores deduplicated problem clusters on impact and effort
 * to calculate priority for startup opportunity ranking.
 */

import type { ProblemCluster } from './deduplicator';
import {
  buildScoringPrompt,
  parseScoreResponse,
  createDefaultScores,
  SCORING_SYSTEM_PROMPT,
  type ScoreResponse,
} from './score-prompts';

/**
 * Score breakdown for a problem
 */
export interface ProblemScores {
  frequency: number;
  severity: number;
  marketSize: number;
  technicalComplexity: number;
  timeToMvp: number;
  impact: number;
  effort: number;
  priority: number;
}

/**
 * AI reasoning for each scored dimension
 */
export interface ScoreReasoning {
  severity: string;
  marketSize: string;
  technicalComplexity: string;
}

/**
 * A scored problem cluster with priority ranking
 */
export interface ScoredProblem extends ProblemCluster {
  scores: ProblemScores;
  reasoning: ScoreReasoning;
}

/**
 * Options for the scoring process
 */
export interface ScoringOptions {
  anthropicApiKey?: string;
  model?: string;
  maxConcurrent?: number;
  delayBetweenCalls?: number;
  useAI?: boolean;
}

const DEFAULT_OPTIONS: Required<ScoringOptions> = {
  anthropicApiKey: '',
  model: 'claude-3-5-haiku-20241022',
  maxConcurrent: 3,
  delayBetweenCalls: 200,
  useAI: true,
};

/**
 * Calculate impact score
 * IMPACT = frequency × severity × marketSize
 */
function calculateImpact(frequency: number, severity: number, marketSize: number): number {
  return frequency * severity * marketSize;
}

/**
 * Calculate effort score
 * EFFORT = technicalComplexity × timeToMvp
 */
function calculateEffort(technicalComplexity: number, timeToMvp: number): number {
  return technicalComplexity * timeToMvp;
}

/**
 * Calculate priority score
 * PRIORITY = IMPACT / EFFORT
 */
function calculatePriority(impact: number, effort: number): number {
  // Avoid division by zero
  if (effort === 0) return impact;
  return impact / effort;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Anthropic API to score a problem cluster
 */
async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string
): Promise<ScoreResponse | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: SCORING_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`Anthropic API error (${response.status}):`, error);
      return null;
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const content = data.content[0]?.text;
    if (!content) {
      console.warn('No content in Anthropic response');
      return null;
    }

    return parseScoreResponse(content);
  } catch (error) {
    console.warn('Anthropic API call failed:', error);
    return null;
  }
}

/**
 * Calculate frequency score (normalized 1-10)
 */
function calculateFrequencyScore(frequency: number): number {
  // Log scale normalization:
  // 1 mention = 1, 3 mentions = 3, 10 mentions = 5, 30 mentions = 7, 100+ = 10
  if (frequency <= 1) return 1;
  if (frequency >= 100) return 10;
  return Math.min(10, Math.max(1, Math.ceil(Math.log10(frequency) * 4 + 1)));
}

/**
 * Score a single problem cluster using AI
 */
export async function scoreProblem(
  cluster: ProblemCluster,
  options: ScoringOptions = {}
): Promise<ScoredProblem> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const apiKey = opts.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';

  // Calculate frequency score from cluster data
  const frequencyScore = calculateFrequencyScore(cluster.frequency);

  let aiScores: ScoreResponse;

  if (opts.useAI && apiKey) {
    const prompt = buildScoringPrompt(cluster);
    const response = await callAnthropic(prompt, apiKey, opts.model);
    aiScores = response || createDefaultScores(cluster);
  } else {
    aiScores = createDefaultScores(cluster);
  }

  // Calculate composite scores
  const impact = calculateImpact(
    frequencyScore,
    aiScores.severity.score,
    aiScores.marketSize.score
  );

  const effort = calculateEffort(
    aiScores.technicalComplexity.score,
    aiScores.timeToMvp.score
  );

  const priority = calculatePriority(impact, effort);

  return {
    ...cluster,
    scores: {
      frequency: frequencyScore,
      severity: aiScores.severity.score,
      marketSize: aiScores.marketSize.score,
      technicalComplexity: aiScores.technicalComplexity.score,
      timeToMvp: aiScores.timeToMvp.score,
      impact,
      effort,
      priority,
    },
    reasoning: {
      severity: aiScores.severity.reasoning,
      marketSize: aiScores.marketSize.reasoning,
      technicalComplexity: aiScores.technicalComplexity.reasoning,
    },
  };
}

/**
 * Score all problem clusters with rate limiting
 */
export async function scoreAll(
  clusters: ProblemCluster[],
  options: ScoringOptions = {}
): Promise<ScoredProblem[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (clusters.length === 0) return [];

  console.log(`Scoring ${clusters.length} problem clusters...`);

  const results: ScoredProblem[] = [];
  const batches: ProblemCluster[][] = [];

  // Split into batches for concurrent processing
  for (let i = 0; i < clusters.length; i += opts.maxConcurrent) {
    batches.push(clusters.slice(i, i + opts.maxConcurrent));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(cluster => scoreProblem(cluster, opts))
    );

    results.push(...batchResults);

    // Progress update
    const completed = Math.min((batchIndex + 1) * opts.maxConcurrent, clusters.length);
    console.log(`Scored ${completed}/${clusters.length} problems`);

    // Rate limiting delay between batches
    if (batchIndex < batches.length - 1 && opts.delayBetweenCalls > 0) {
      await sleep(opts.delayBetweenCalls);
    }
  }

  // Sort by priority (highest first)
  results.sort((a, b) => b.scores.priority - a.scores.priority);

  console.log(`Scoring complete. Top priority: ${results[0]?.scores.priority.toFixed(2) || 'N/A'}`);

  return results;
}

/**
 * Get summary statistics for scored problems
 */
export function getScoringStats(problems: ScoredProblem[]): {
  count: number;
  avgPriority: number;
  avgImpact: number;
  avgEffort: number;
  topByPriority: Array<{ statement: string; priority: number }>;
  topByImpact: Array<{ statement: string; impact: number }>;
  quickWins: Array<{ statement: string; priority: number; effort: number }>;
} {
  if (problems.length === 0) {
    return {
      count: 0,
      avgPriority: 0,
      avgImpact: 0,
      avgEffort: 0,
      topByPriority: [],
      topByImpact: [],
      quickWins: [],
    };
  }

  const avgPriority = problems.reduce((sum, p) => sum + p.scores.priority, 0) / problems.length;
  const avgImpact = problems.reduce((sum, p) => sum + p.scores.impact, 0) / problems.length;
  const avgEffort = problems.reduce((sum, p) => sum + p.scores.effort, 0) / problems.length;

  // Top 5 by priority
  const topByPriority = [...problems]
    .sort((a, b) => b.scores.priority - a.scores.priority)
    .slice(0, 5)
    .map(p => ({ statement: p.problemStatement, priority: p.scores.priority }));

  // Top 5 by impact
  const topByImpact = [...problems]
    .sort((a, b) => b.scores.impact - a.scores.impact)
    .slice(0, 5)
    .map(p => ({ statement: p.problemStatement, impact: p.scores.impact }));

  // Quick wins: high priority + low effort
  const quickWins = [...problems]
    .filter(p => p.scores.effort <= 25) // Complexity * TimeToMVP <= 5*5
    .sort((a, b) => b.scores.priority - a.scores.priority)
    .slice(0, 5)
    .map(p => ({
      statement: p.problemStatement,
      priority: p.scores.priority,
      effort: p.scores.effort,
    }));

  return {
    count: problems.length,
    avgPriority,
    avgImpact,
    avgEffort,
    topByPriority,
    topByImpact,
    quickWins,
  };
}

/**
 * Export scored problems to JSON format
 */
export function exportScoredProblems(problems: ScoredProblem[]): string {
  return JSON.stringify(
    problems.map(p => ({
      id: p.id,
      problemStatement: p.problemStatement,
      frequency: p.frequency,
      sources: p.sources,
      scores: p.scores,
      reasoning: p.reasoning,
      representativePost: {
        source: p.representativePost.source,
        title: p.representativePost.title,
        url: p.representativePost.url,
      },
    })),
    null,
    2
  );
}

/**
 * Filter problems by minimum priority threshold
 */
export function filterByPriority(
  problems: ScoredProblem[],
  minPriority: number
): ScoredProblem[] {
  return problems.filter(p => p.scores.priority >= minPriority);
}

/**
 * Filter problems by effort level
 */
export function filterByEffort(
  problems: ScoredProblem[],
  maxEffort: number
): ScoredProblem[] {
  return problems.filter(p => p.scores.effort <= maxEffort);
}

/**
 * Get problems suitable for a weekend hackathon
 * (low effort, decent priority)
 */
export function getWeekendProjects(problems: ScoredProblem[]): ScoredProblem[] {
  return problems
    .filter(p => p.scores.timeToMvp <= 2 && p.scores.technicalComplexity <= 4)
    .sort((a, b) => b.scores.priority - a.scores.priority);
}
