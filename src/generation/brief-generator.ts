/**
 * Business Brief Generator for ZeroToShip
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
import { getRecommendedStack, type EffortLevel, type TechStackRecommendation } from './tech-stacks';
import { getBriefModel, type UserTier } from '../config/models';
import { callAnthropicApi } from '../lib/anthropic';
import { sleep } from '../lib/utils';

/** Fallback reason taxonomy used for Phase 0 diagnostics (v1) */
export type FallbackReason =
  | 'missing_gap_analysis'
  | 'missing_api_key'
  | 'single_call_failed'
  | 'batch_call_failed'
  | 'unknown';

export interface BriefGenerationMeta {
  isFallback: boolean;
  fallbackReason?: FallbackReason;
  providerMode?: 'legacy' | 'graph';
  graphAttemptCount?: number;
  graphModelsUsed?: string[];
  graphFailedSections?: string[];
  graphRetriedSections?: string[];
}

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
  sources: Array<{
    platform: 'reddit' | 'hn' | 'twitter' | 'github';
    title: string;
    url: string;
    score: number;
    commentCount: number;
    postedAt: string;
  }>;
  generatedAt: Date;
  generationMeta?: BriefGenerationMeta;
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
 * Generate unique brief ID
 */
function generateBriefId(): string {
  return `brief_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Extract top source posts from a scored problem, ranked by engagement.
 * Filters out posts with missing URLs or titles, and safely coerces dates.
 */
function extractSources(problem: ScoredProblem): IdeaBrief['sources'] {
  const related = problem.relatedPosts ?? [];
  const allPosts = [problem.representativePost, ...related];
  return allPosts
    .filter(post => post && post.url && post.title)
    .sort((a, b) => ((b.score || 0) + (b.commentCount || 0)) - ((a.score || 0) + (a.commentCount || 0)))
    .slice(0, 5)
    .map(post => ({
      platform: post.source,
      title: post.title,
      url: post.url,
      score: post.score || 0,
      commentCount: post.commentCount || 0,
      postedAt: safeISODate(post.createdAt),
    }));
}

/**
 * Safely convert a value to an ISO date string.
 * Handles Date objects, ISO strings, numeric timestamps, and fallbacks.
 */
function safeISODate(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
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
  try {
    const result = await callAnthropicApi({
      apiKey,
      model,
      system: BRIEF_SYSTEM_PROMPT,
      prompt,
      maxTokens: SINGLE_BRIEF_MAX_TOKENS,
      temperature,
      module: 'brief-generator',
    });

    return parseJsonResponse<GPTBriefResponse>(result.text);
  } catch (error) {
    logger.warn({ err: error }, 'Anthropic API call failed');
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
  const maxTokens = Math.min(TOKENS_PER_BRIEF_ESTIMATE * batchSize, BATCH_MAX_OUTPUT_TOKENS);

  try {
    const result = await callAnthropicApi({
      apiKey,
      model,
      system: BRIEF_SYSTEM_PROMPT,
      prompt,
      maxTokens,
      temperature,
      module: 'brief-generator',
      batchSize,
    });

    return parseJsonResponse<GPTBatchBriefResponse[]>(result.text);
  } catch (error) {
    logger.warn({ err: error }, 'Anthropic API batch call failed');
    return null;
  }
}

/**
 * Create a fallback brief when API fails
 */
function createFallbackBrief(
  problem: ScoredProblem,
  gaps: GapAnalysis,
  effortLevel: EffortLevel,
  fallbackReason: FallbackReason
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

    sources: extractSources(problem),
    generatedAt: new Date(),
    generationMeta: {
      isFallback: true,
      fallbackReason,
    },
  };
}

/**
 * Validate brief quality before publishing.
 * Returns reasons array — empty means brief passes validation.
 */
export function validateBriefQuality(brief: IdeaBrief): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Placeholder content detection
  const placeholderPatterns = [
    /^TBD$/i,
    /to be determined/i,
    /placeholder/i,
    /research required/i,
    /pending$/i,
    /^Untitled/i,
    /^Core feature \d/i,
    /^Feature \d$/i,
    /^Test /i,
    /^Our solution$/i,
    /manual analysis required/i,
  ];

  const fieldsToCheck: Array<[string, string]> = [
    ['name', brief.name],
    ['tagline', brief.tagline],
    ['problemStatement', brief.problemStatement],
    ['targetAudience', brief.targetAudience],
    ['marketSize', brief.marketSize],
    ['existingSolutions', brief.existingSolutions],
    ['gaps', brief.gaps],
    ['proposedSolution', brief.proposedSolution],
    ['mvpScope', brief.mvpScope],
    ['revenueEstimate', brief.revenueEstimate],
  ];

  for (const [field, value] of fieldsToCheck) {
    for (const pattern of placeholderPatterns) {
      if (pattern.test(value)) {
        reasons.push(`${field} contains placeholder content: "${value.slice(0, 50)}"`);
        break;
      }
    }
  }

  // Minimum field lengths
  if (brief.name.length < 2) reasons.push('name too short (< 2 chars)');
  if (brief.tagline.length < 10) reasons.push('tagline too short (< 10 chars)');
  if (brief.problemStatement.length < 50) reasons.push('problemStatement too short (< 50 chars)');
  if (brief.targetAudience.length < 20) reasons.push('targetAudience too short (< 20 chars)');
  if (brief.proposedSolution.length < 30) reasons.push('proposedSolution too short (< 30 chars)');

  // Array minimums
  if (brief.keyFeatures.length < 3) reasons.push(`keyFeatures has ${brief.keyFeatures.length} items (need >= 3)`);
  if (brief.risks.length < 2) reasons.push(`risks has ${brief.risks.length} items (need >= 2)`);
  if (brief.goToMarket.channels.length < 2) reasons.push(`channels has ${brief.goToMarket.channels.length} items (need >= 2)`);

  // Nested object checks
  if (brief.technicalSpec.stack.length < 2) reasons.push(`tech stack has ${brief.technicalSpec.stack.length} items (need >= 2)`);
  if (brief.businessModel.pricing.length < 10) reasons.push('pricing too short (< 10 chars)');

  return { valid: reasons.length === 0, reasons };
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

    sources: extractSources(problem),
    generatedAt: new Date(),
    generationMeta: {
      isFallback: false,
    },
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
    return createFallbackBrief(problem, gaps, effortLevel, 'missing_api_key');
  }

  // Build prompt
  const prompt = buildBriefPrompt(problem, gaps, stackRec, effortLevel);

  // Call Claude with tier-appropriate model
  logger.info({ model, tier: opts.userTier }, 'Generating brief');
  const response = await callClaude(prompt, apiKey, model, opts.temperature);

  if (!response) {
    logger.warn({ problemId: problem.id }, 'Brief generation failed, using fallback');
    return createFallbackBrief(problem, gaps, effortLevel, 'single_call_failed');
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

  // Batch size for brief generation — use 1 for full-context single prompts
  const BRIEF_BATCH_SIZE = 1;

  // Prepare all problems with their gap analyses
  const problemsWithGaps: Array<{
    problem: ScoredProblem;
    gaps: GapAnalysis;
    effortLevel: EffortLevel;
    stackRec: TechStackRecommendation;
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
      }, effortLevel, 'missing_gap_analysis'));
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
      results.push(createFallbackBrief(problem, gaps, effortLevel, 'missing_api_key'));
    }
    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results;
  }

  // Process in batches
  for (let i = 0; i < problemsWithGaps.length; i += BRIEF_BATCH_SIZE) {
    const batch = problemsWithGaps.slice(i, i + BRIEF_BATCH_SIZE);

    if (batch.length === 1) {
      // Single brief — use full-context prompt
      const { problem, gaps, effortLevel, stackRec } = batch[0];
      const prompt = buildBriefPrompt(problem, gaps, stackRec, effortLevel);
      const response = await callClaude(prompt, apiKey, model, opts.temperature);

      if (response) {
        results.push(transformToBrief(response, problem, effortLevel, stackRec.stack));
      } else {
        logger.warn({ problemId: problem.id }, 'Single brief generation failed, using fallback');
        results.push(createFallbackBrief(problem, gaps, effortLevel, 'single_call_failed'));
      }
    } else {
      // Batch path (kept for future use but currently batch size is 1)
      const batchData = batch.map(({ problem, gaps, effortLevel, stackRec }) => ({
        id: problem.id,
        problem,
        gaps,
        stackRecommendation: stackRec,
        effortLevel,
      }));

      const prompt = buildBatchBriefPrompt(batchData);

      const batchResponses = await callClaudeBatch(
        prompt,
        apiKey,
        model,
        opts.temperature,
        batch.length
      );

      if (batchResponses && batchResponses.length > 0) {
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
        logger.warn({ batchSize: batch.length }, 'Batch brief generation failed, using fallbacks');
        for (const { problem, gaps, effortLevel } of batch) {
          results.push(createFallbackBrief(problem, gaps, effortLevel, 'batch_call_failed'));
        }
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

  if (brief.sources.length > 0) {
    lines.push('## Sources');
    for (const source of brief.sources) {
      lines.push(`- [${source.platform}] ${source.title} (${source.score} upvotes, ${source.commentCount} comments) - ${source.url}`);
    }
    lines.push('');
  }

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
