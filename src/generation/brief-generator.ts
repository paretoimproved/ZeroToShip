/**
 * Business Brief Generator for IdeaForge
 *
 * Generates comprehensive business briefs using GPT-4
 * from scored problems and gap analyses.
 */

import type { ScoredProblem } from '../analysis/scorer';
import type { GapAnalysis } from '../analysis/gap-analyzer';
import {
  BRIEF_SYSTEM_PROMPT,
  buildBriefPrompt,
  parseJsonResponse,
  scoreToEffortLevel,
} from './templates';
import { getRecommendedStack, type EffortLevel } from './tech-stacks';

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
export interface BriefGeneratorConfig {
  openaiApiKey?: string;
  model?: string;
  maxConcurrent?: number;
  delayBetweenCalls?: number;
  temperature?: number;
}

const DEFAULT_CONFIG: Required<BriefGeneratorConfig> = {
  openaiApiKey: '',
  model: 'gpt-4o',
  maxConcurrent: 2,
  delayBetweenCalls: 500,
  temperature: 0.7,
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
  return `brief_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Call OpenAI API for brief generation
 */
async function callGPT4(
  prompt: string,
  apiKey: string,
  model: string,
  temperature: number
): Promise<GPTBriefResponse | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: BRIEF_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`OpenAI API error (${response.status}):`, error);
      return null;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.warn('No content in OpenAI response');
      return null;
    }

    return parseJsonResponse<GPTBriefResponse>(content);
  } catch (error) {
    console.warn('OpenAI API call failed:', error);
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
  const apiKey = opts.openaiApiKey || process.env.OPENAI_API_KEY || '';

  // Determine effort level from scores
  const effortLevel = scoreToEffortLevel(problem.scores);

  // Get recommended tech stack
  const stackRec = getRecommendedStack(problem.problemStatement, effortLevel);

  // If no API key, return fallback
  if (!apiKey) {
    console.warn('No OpenAI API key - returning fallback brief');
    return createFallbackBrief(problem, gaps, effortLevel);
  }

  // Build prompt
  const prompt = buildBriefPrompt(problem, gaps, stackRec, effortLevel);

  // Call GPT-4
  const response = await callGPT4(prompt, apiKey, opts.model, opts.temperature);

  if (!response) {
    console.warn(`Brief generation failed for problem ${problem.id} - using fallback`);
    return createFallbackBrief(problem, gaps, effortLevel);
  }

  return transformToBrief(response, problem, effortLevel, stackRec.stack);
}

/**
 * Generate briefs for multiple problems
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

  console.log(`Generating briefs for ${scoredProblems.length} problems...`);

  // Process in batches
  for (let i = 0; i < scoredProblems.length; i += opts.maxConcurrent) {
    const batch = scoredProblems.slice(i, i + opts.maxConcurrent);

    const batchPromises = batch.map(async problem => {
      const gaps = gapAnalyses.get(problem.id);

      if (!gaps) {
        console.warn(`No gap analysis found for problem ${problem.id}`);
        const effortLevel = scoreToEffortLevel(problem.scores);
        return createFallbackBrief(problem, {
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
        }, effortLevel);
      }

      return generateBrief(problem, gaps, opts);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    const completed = Math.min(i + opts.maxConcurrent, scoredProblems.length);
    console.log(`Generated ${completed}/${scoredProblems.length} briefs`);

    // Rate limiting
    if (i + opts.maxConcurrent < scoredProblems.length) {
      await sleep(opts.delayBetweenCalls);
    }
  }

  // Sort by priority score
  results.sort((a, b) => b.priorityScore - a.priorityScore);

  console.log('Brief generation complete');
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
