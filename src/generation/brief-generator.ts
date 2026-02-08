/**
 * Business Brief Generator for IdeaForge
 *
 * Generates comprehensive business briefs using GPT-4
 * from scored problems and gap analyses.
 */

import * as crypto from 'crypto';
import type { ScoredProblem } from '../analysis/scorer';
import type { GapAnalysis } from '../analysis/gap-analyzer';
import { config as envConfig } from '../config/env';
import logger from '../lib/logger';
import {
  BRIEF_SYSTEM_PROMPT,
  buildBriefPrompt,
  buildBatchBriefPrompt,
  parseJsonResponse,
  scoreToEffortLevel,
} from './templates';
import { getRecommendedStack, type EffortLevel } from './tech-stacks';
import { getBriefModel, type UserTier } from '../config/models';
import { getGlobalMetrics } from '../scheduler/utils/api-metrics';
import { estimateTokens } from '../scheduler/utils/token-estimator';

/**
 * Complete business brief for a startup idea
 */
export interface IdeaBrief {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: EffortLevel;
  revenueEstimate: string;

  problemStatement: string;
  targetAudience: string;
  marketSize: string;

  existingSolutions: string;
  gaps: string;

  proposedSolution: string;
  keyFeatures: string[];
  mvpScope: string;

  technicalSpec: {
    stack: string[];
    architecture: string;
    estimatedEffort: string;
  };

  businessModel: {
    pricing: string;
    revenueProjection: string;
    monetizationPath: string;
  };

  goToMarket: {
    launchStrategy: string;
    channels: string[];
    firstCustomers: string;
  };

  risks: string[];
  generatedAt: Date;
}

/**
 * Raw response from GPT-4
 */
interface GPTBriefResponse {
  name: string;
  tagline: string;
  problemStatement: string;
  targetAudience: string;
  marketSize: string;
  existingSolutions: string;
  gaps: string;
  proposedSolution: string;
  keyFeatures: string[];
  mvpScope: string;
  architecture: string;
  pricing: string;
  revenueProjection: string;
  monetizationPath: string;
  launchStrategy: string;
  channels: string[];
  firstCustomers: string;
  risks: string[];
}

/**
 * Configuration for brief generation
 */
/** Max tokens for a single brief generation API call */
const SINGLE_BRIEF_MAX_TOKENS = 4000;

/** Estimated tokens per brief in batch generation */
const TOKENS_PER_BRIEF_ESTIMATE = 3500;

/** Max output tokens for Haiku model in batch calls */
const BATCH_MAX_OUTPUT_TOKENS = 16000;

/** Default max concurrent brief generation API calls */
const DEFAULT_MAX_CONCURRENT = 2;

/** Default delay between brief generation API calls (ms) */
const DEFAULT_DELAY_BETWEEN_CALLS_MS = 500;

/** Default temperature for AI brief generation (creativity vs consistency) */
const DEFAULT_TEMPERATURE = 0.7;

export interface BriefGeneratorConfig {
  anthropicApiKey?: string;
  model?: string;
  userTier?: UserTier;
  maxConcurrent?: number;
  delayBetweenCalls?: number;
  temperature?: number;
}

const DEFAULT_CONFIG: Required<BriefGeneratorConfig> = {
  anthropicApiKey: '',
  model: '',
  userTier: 'pro',
  maxConcurrent: DEFAULT_MAX_CONCURRENT,
  delayBetweenCalls: DEFAULT_DELAY_BETWEEN_CALLS_MS,
  temperature: DEFAULT_TEMPERATURE,
};

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique brief ID
 */
function generateBriefId(): string {
  return `brief_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Call Anthropic API for brief generation
 */
async function callClaude(
  prompt: string,
  apiKey: string,
  model: string,
  temperature: number
): Promise<GPTBriefResponse | null> {
  const startTime = Date.now();
  const inputTokens = estimateTokens(BRIEF_SYSTEM_PROMPT) + estimateTokens(prompt);

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
        max_tokens: SINGLE_BRIEF_MAX_TOKENS,
        temperature,
        system: BRIEF_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.warn({ status: response.status, error }, 'Anthropic API error');

      // Record failed call
      getGlobalMetrics().recordCall({
        timestamp: new Date(),
        module: 'brief-generator',
        model,
        batchSize: 1,
        itemsProcessed: 0,
        inputTokens,
        outputTokens: 0,
        success: false,
        durationMs: Date.now() - startTime,
      });

      return null;
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const content = data.content[0]?.text;
    if (!content) {
      logger.warn('No content in Anthropic response');
      return null;
    }

    // Record successful call
    getGlobalMetrics().recordCall({
      timestamp: new Date(),
      module: 'brief-generator',
      model,
      batchSize: 1,
      itemsProcessed: 1,
      inputTokens,
      outputTokens: estimateTokens(content),
      success: true,
      durationMs: Date.now() - startTime,
    });

    return parseJsonResponse<GPTBriefResponse>(content);
  } catch (error) {
    logger.warn({ err: error }, 'Anthropic API call failed');

    // Record failed call
    getGlobalMetrics().recordCall({
      timestamp: new Date(),
      module: 'brief-generator',
      model,
      batchSize: 1,
      itemsProcessed: 0,
      inputTokens,
      outputTokens: 0,
      success: false,
      durationMs: Date.now() - startTime,
    });

    return null;
  }
}

/**
 * Raw response from batch brief generation
 */
interface GPTBatchBriefResponse {
  id: string;
  name: string;
  tagline: string;
  problemStatement: string;
  targetAudience: string;
  marketSize: string;
  existingSolutions: string;
  gaps: string;
  proposedSolution: string;
  keyFeatures: string[];
  mvpScope: string;
  architecture: string;
  pricing: string;
  revenueProjection: string;
  monetizationPath: string;
  launchStrategy: string;
  channels: string[];
  firstCustomers: string;
  risks: string[];
}

/**
 * Call Anthropic API for batch brief generation
 */
async function callClaudeBatch(
  prompt: string,
  apiKey: string,
  model: string,
  temperature: number,
  batchSize: number
): Promise<GPTBatchBriefResponse[] | null> {
  const startTime = Date.now();
  const inputTokens = estimateTokens(BRIEF_SYSTEM_PROMPT) + estimateTokens(prompt);

  const maxTokens = Math.min(TOKENS_PER_BRIEF_ESTIMATE * batchSize, BATCH_MAX_OUTPUT_TOKENS);

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
        max_tokens: maxTokens,
        temperature,
        system: BRIEF_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.warn({ status: response.status, error }, 'Anthropic API error');

      getGlobalMetrics().recordCall({
        timestamp: new Date(),
        module: 'brief-generator',
        model,
        batchSize,
        itemsProcessed: 0,
        inputTokens,
        outputTokens: 0,
        success: false,
        durationMs: Date.now() - startTime,
      });

      return null;
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const content = data.content[0]?.text;
    if (!content) {
      logger.warn('No content in Anthropic response');
      return null;
    }

    const parsed = parseJsonResponse<GPTBatchBriefResponse[]>(content);

    getGlobalMetrics().recordCall({
      timestamp: new Date(),
      module: 'brief-generator',
      model,
      batchSize,
      itemsProcessed: parsed?.length || 0,
      inputTokens,
      outputTokens: estimateTokens(content),
      success: true,
      durationMs: Date.now() - startTime,
    });

    return parsed;
  } catch (error) {
    logger.warn({ err: error }, 'Anthropic API batch call failed');

    getGlobalMetrics().recordCall({
      timestamp: new Date(),
      module: 'brief-generator',
      model,
      batchSize,
      itemsProcessed: 0,
      inputTokens,
      outputTokens: 0,
      success: false,
      durationMs: Date.now() - startTime,
    });

    return null;
  }
}

/**
 * Create a fallback brief when API fails
 */
function createFallbackBrief(
  problem: ScoredProblem,
  gaps: GapAnalysis,
  effortLevel: EffortLevel
): IdeaBrief {
  const stack = getRecommendedStack(problem.problemStatement, effortLevel);

  return {
    id: generateBriefId(),
    name: 'Untitled Project',
    tagline: problem.problemStatement.slice(0, 50),
    priorityScore: problem.scores.priority,
    effortEstimate: effortLevel,
    revenueEstimate: 'TBD - manual analysis required',

    problemStatement: problem.problemStatement,
    targetAudience: 'To be determined through customer discovery',
    marketSize: 'Research required',

    existingSolutions: gaps.existingSolutions.map(s => s.name).join(', ') || 'None identified',
    gaps: gaps.gaps.join('; ') || 'No specific gaps identified',

    proposedSolution: `Solution to: ${problem.problemStatement}`,
    keyFeatures: ['Core feature 1', 'Core feature 2', 'Core feature 3'],
    mvpScope: 'Minimal viable product scope to be defined',

    technicalSpec: {
      stack: stack.stack,
      architecture: stack.architecture,
      estimatedEffort: effortLevel,
    },

    businessModel: {
      pricing: 'Freemium or subscription model',
      revenueProjection: 'Depends on market validation',
      monetizationPath: 'Start free, convert to paid',
    },

    goToMarket: {
      launchStrategy: `Launch on ${problem.sources.join(', ')} where problem was discovered`,
      channels: problem.sources,
      firstCustomers: 'Target users experiencing the problem directly',
    },

    risks: [
      'Market validation required',
      'Competition analysis needed',
      'Technical feasibility to be verified',
    ],

    generatedAt: new Date(),
  };
}

/**
 * Transform GPT response to IdeaBrief
 */
function transformToBrief(
  response: GPTBriefResponse,
  problem: ScoredProblem,
  effortLevel: EffortLevel,
  stack: string[]
): IdeaBrief {
  return {
    id: generateBriefId(),
    name: response.name || 'Untitled',
    tagline: response.tagline || problem.problemStatement.slice(0, 50),
    priorityScore: problem.scores.priority,
    effortEstimate: effortLevel,
    revenueEstimate: response.revenueProjection || 'TBD',

    problemStatement: response.problemStatement || problem.problemStatement,
    targetAudience: response.targetAudience || 'General users',
    marketSize: response.marketSize || 'Research required',

    existingSolutions: response.existingSolutions || 'None identified',
    gaps: response.gaps || 'No gaps identified',

    proposedSolution: response.proposedSolution || 'Solution pending',
    keyFeatures: response.keyFeatures || [],
    mvpScope: response.mvpScope || 'MVP scope pending',

    technicalSpec: {
      stack,
      architecture: response.architecture || 'Standard web architecture',
      estimatedEffort: effortLevel,
    },

    businessModel: {
      pricing: response.pricing || 'TBD',
      revenueProjection: response.revenueProjection || 'TBD',
      monetizationPath: response.monetizationPath || 'TBD',
    },

    goToMarket: {
      launchStrategy: response.launchStrategy || 'Direct launch',
      channels: response.channels || [],
      firstCustomers: response.firstCustomers || 'Early adopters',
    },

    risks: response.risks || [],

    generatedAt: new Date(),
  };
}

/**
 * Generate a business brief for a single problem
 */
export async function generateBrief(
  problem: ScoredProblem,
  gaps: GapAnalysis,
  config: BriefGeneratorConfig = {}
): Promise<IdeaBrief> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const apiKey = opts.anthropicApiKey || envConfig.ANTHROPIC_API_KEY;

  // Select model: explicit config > tier-based selection
  const model = opts.model || getBriefModel(opts.userTier);

  // Determine effort level from scores
  const effortLevel = scoreToEffortLevel(problem.scores);

  // Get recommended tech stack
  const stackRec = getRecommendedStack(problem.problemStatement, effortLevel);

  // If no API key, return fallback
  if (!apiKey) {
    logger.warn('No Anthropic API key - returning fallback brief');
    return createFallbackBrief(problem, gaps, effortLevel);
  }

  // Build prompt
  const prompt = buildBriefPrompt(problem, gaps, stackRec, effortLevel);

  // Call Claude with tier-appropriate model
  logger.info({ model, tier: opts.userTier }, 'Generating brief');
  const response = await callClaude(prompt, apiKey, model, opts.temperature);

  if (!response) {
    logger.warn({ problemId: problem.id }, 'Brief generation failed, using fallback');
    return createFallbackBrief(problem, gaps, effortLevel);
  }

  return transformToBrief(response, problem, effortLevel, stackRec.stack);
}

/**
 * Generate briefs for multiple problems using batch API calls
 */
export async function generateAllBriefs(
  scoredProblems: ScoredProblem[],
  gapAnalyses: Map<string, GapAnalysis>,
  config: BriefGeneratorConfig = {}
): Promise<IdeaBrief[]> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const results: IdeaBrief[] = [];

  if (scoredProblems.length === 0) {
    return results;
  }

  const apiKey = opts.anthropicApiKey || envConfig.ANTHROPIC_API_KEY;
  const model = opts.model || getBriefModel(opts.userTier);
  logger.info({ count: scoredProblems.length, model, tier: opts.userTier }, 'Generating briefs');

  // Batch size for brief generation (5 briefs per API call for quality balance)
  const BRIEF_BATCH_SIZE = 3;

  // Prepare all problems with their gap analyses
  const problemsWithGaps: Array<{
    problem: ScoredProblem;
    gaps: GapAnalysis;
    effortLevel: EffortLevel;
    stackRec: { stack: string[]; architecture: string; estimatedCost: string };
  }> = [];

  for (const problem of scoredProblems) {
    const gaps = gapAnalyses.get(problem.id);
    if (!gaps) {
      logger.warn({ problemId: problem.id }, 'No gap analysis found for problem');
      const effortLevel = scoreToEffortLevel(problem.scores);
      results.push(createFallbackBrief(problem, {
        problemId: problem.id,
        problemStatement: problem.problemStatement,
        searchQueries: [],
        existingSolutions: [],
        gaps: [],
        marketOpportunity: 'medium',
        differentiationAngles: [],
        recommendation: 'Manual analysis required',
        competitionScore: 50,
        analysisNotes: 'Gap analysis not available',
        analyzedAt: new Date(),
      }, effortLevel));
      continue;
    }

    const effortLevel = scoreToEffortLevel(problem.scores);
    const stackRec = getRecommendedStack(problem.problemStatement, effortLevel);
    problemsWithGaps.push({ problem, gaps, effortLevel, stackRec });
  }

  // If no API key, return fallbacks for remaining
  if (!apiKey) {
    logger.warn('No Anthropic API key - returning fallback briefs');
    for (const { problem, gaps, effortLevel } of problemsWithGaps) {
      results.push(createFallbackBrief(problem, gaps, effortLevel));
    }
    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results;
  }

  // Process in batches
  for (let i = 0; i < problemsWithGaps.length; i += BRIEF_BATCH_SIZE) {
    const batch = problemsWithGaps.slice(i, i + BRIEF_BATCH_SIZE);

    // Build batch prompt
    const batchData = batch.map(({ problem, gaps, effortLevel, stackRec }) => ({
      id: problem.id,
      problem,
      gaps,
      stackRecommendation: stackRec,
      effortLevel,
    }));

    const prompt = buildBatchBriefPrompt(batchData);

    // Call API with batch
    const batchResponses = await callClaudeBatch(
      prompt,
      apiKey,
      model,
      opts.temperature,
      batch.length
    );

    if (batchResponses && batchResponses.length > 0) {
      // Map responses back to briefs
      for (const response of batchResponses) {
        const matchingData = batch.find(b => b.problem.id === response.id);
        if (matchingData) {
          results.push(transformToBrief(
            response,
            matchingData.problem,
            matchingData.effortLevel,
            matchingData.stackRec.stack
          ));
        }
      }
    } else {
      // Fallback for failed batch
      logger.warn({ batchSize: batch.length }, 'Batch brief generation failed, using fallbacks');
      for (const { problem, gaps, effortLevel } of batch) {
        results.push(createFallbackBrief(problem, gaps, effortLevel));
      }
    }

    const completed = Math.min(i + BRIEF_BATCH_SIZE, problemsWithGaps.length);
    logger.info({ completed, total: problemsWithGaps.length }, 'Brief generation progress');

    // Rate limiting between batches
    if (i + BRIEF_BATCH_SIZE < problemsWithGaps.length) {
      await sleep(opts.delayBetweenCalls);
    }
  }

  // Sort by priority score
  results.sort((a, b) => b.priorityScore - a.priorityScore);

  logger.info('Brief generation complete');
  return results;
}

/**
 * Format a brief as markdown
 */
export function formatBriefMarkdown(brief: IdeaBrief): string {
  const lines: string[] = [];

  lines.push(`# ${brief.name}`);
  lines.push('');
  lines.push(`*${brief.tagline}*`);
  lines.push('');
  lines.push(`**Priority Score:** ${brief.priorityScore.toFixed(2)} | **Effort:** ${brief.effortEstimate} | **Revenue Potential:** ${brief.revenueEstimate}`);
  lines.push('');

  lines.push('## Problem');
  lines.push(brief.problemStatement);
  lines.push('');

  lines.push('## Target Audience');
  lines.push(brief.targetAudience);
  lines.push('');

  lines.push('## Market Size');
  lines.push(brief.marketSize);
  lines.push('');

  lines.push('## Existing Solutions');
  lines.push(brief.existingSolutions);
  lines.push('');

  lines.push('## Market Gaps');
  lines.push(brief.gaps);
  lines.push('');

  lines.push('## Proposed Solution');
  lines.push(brief.proposedSolution);
  lines.push('');

  lines.push('### Key Features');
  for (const feature of brief.keyFeatures) {
    lines.push(`- ${feature}`);
  }
  lines.push('');

  lines.push('### MVP Scope');
  lines.push(brief.mvpScope);
  lines.push('');

  lines.push('## Technical Specification');
  lines.push(`**Stack:** ${brief.technicalSpec.stack.join(', ')}`);
  lines.push('');
  lines.push(`**Architecture:** ${brief.technicalSpec.architecture}`);
  lines.push('');
  lines.push(`**Estimated Effort:** ${brief.technicalSpec.estimatedEffort}`);
  lines.push('');

  lines.push('## Business Model');
  lines.push(`**Pricing:** ${brief.businessModel.pricing}`);
  lines.push('');
  lines.push(`**Revenue Projection:** ${brief.businessModel.revenueProjection}`);
  lines.push('');
  lines.push(`**Monetization Path:** ${brief.businessModel.monetizationPath}`);
  lines.push('');

  lines.push('## Go-to-Market Strategy');
  lines.push(`**Launch Strategy:** ${brief.goToMarket.launchStrategy}`);
  lines.push('');
  lines.push(`**Channels:** ${brief.goToMarket.channels.join(', ')}`);
  lines.push('');
  lines.push(`**First Customers:** ${brief.goToMarket.firstCustomers}`);
  lines.push('');

  lines.push('## Risks');
  for (const risk of brief.risks) {
    lines.push(`- ${risk}`);
  }
  lines.push('');

  lines.push('---');
  lines.push(`*Generated: ${brief.generatedAt.toISOString()}*`);

  return lines.join('\n');
}

/**
 * Export briefs to JSON
 */
export function exportBriefs(briefs: IdeaBrief[]): string {
  return JSON.stringify(briefs, null, 2);
}

/**
 * Get brief generation statistics
 */
export function getBriefStats(briefs: IdeaBrief[]): {
  total: number;
  byEffort: Record<EffortLevel, number>;
  avgPriorityScore: number;
  topIdeas: Array<{ name: string; tagline: string; priority: number }>;
} {
  const byEffort: Record<EffortLevel, number> = {
    weekend: 0,
    week: 0,
    month: 0,
    quarter: 0,
  };

  for (const brief of briefs) {
    byEffort[brief.effortEstimate]++;
  }

  const avgPriorityScore = briefs.length > 0
    ? briefs.reduce((sum, b) => sum + b.priorityScore, 0) / briefs.length
    : 0;

  return {
    total: briefs.length,
    byEffort,
    avgPriorityScore,
    topIdeas: briefs.slice(0, 5).map(b => ({
      name: b.name,
      tagline: b.tagline,
      priority: b.priorityScore,
    })),
  };
}

/**
 * Filter briefs by effort level
 */
export function filterByEffort(briefs: IdeaBrief[], effort: EffortLevel): IdeaBrief[] {
  return briefs.filter(b => b.effortEstimate === effort);
}

/**
 * Filter briefs by minimum priority
 */
export function filterByPriority(briefs: IdeaBrief[], minPriority: number): IdeaBrief[] {
  return briefs.filter(b => b.priorityScore >= minPriority);
}

/**
 * Get quick win ideas (weekend projects with high priority)
 */
export function getQuickWins(briefs: IdeaBrief[]): IdeaBrief[] {
  return briefs
    .filter(b => b.effortEstimate === 'weekend' || b.effortEstimate === 'week')
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
