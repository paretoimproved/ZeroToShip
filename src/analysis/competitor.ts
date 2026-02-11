/**
 * Competitor Analysis Module for Gap Analysis
 *
 * Uses AI to analyze search results and identify competitors,
 * their strengths, weaknesses, and market positioning.
 */

import type { SearchResult } from './web-search';
import { getBatchModel } from '../config/models';
import { config } from '../config/env';
import logger from '../lib/logger';
import { callAnthropicApi } from '../lib/anthropic';

/**
 * A competitor identified from search results
 */
export interface Competitor {
  name: string;
  url: string;
  description: string;
  pricing: string;
  strengths: string[];
  weaknesses: string[];
}

/**
 * AI-generated analysis of the competitive landscape
 */
export interface CompetitorAnalysis {
  competitors: Competitor[];
  gaps: string[];
  marketOpportunity: 'high' | 'medium' | 'low' | 'saturated';
  differentiationAngles: string[];
  analysisNotes: string;
}

/**
 * Options for competitor analysis
 */
export interface CompetitorAnalysisOptions {
  anthropicApiKey?: string;
  model?: string;
  maxCompetitors?: number;
}

const DEFAULT_OPTIONS: Required<CompetitorAnalysisOptions> = {
  anthropicApiKey: '',
  model: getBatchModel(),
  maxCompetitors: 10,
};

/**
 * Filter search results to likely competitor/product pages
 */
export function filterProductResults(results: SearchResult[]): SearchResult[] {
  const productDomains = [
    'producthunt.com',
    'capterra.com',
    'g2.com',
    'getapp.com',
    'softwareadvice.com',
    'trustradius.com',
    'alternativeto.net',
    'sourceforge.net',
  ];

  const excludeDomains = [
    'wikipedia.org',
    'reddit.com',
    'quora.com',
    'stackoverflow.com',
    'twitter.com',
    'facebook.com',
    'linkedin.com',
    'youtube.com',
  ];

  return results.filter(r => {
    const domain = r.domain.toLowerCase();

    // Exclude social/discussion sites
    if (excludeDomains.some(d => domain.includes(d))) {
      return false;
    }

    // Prioritize product listing sites
    if (productDomains.some(d => domain.includes(d))) {
      return true;
    }

    // Include results that look like product pages
    const lowerTitle = r.title.toLowerCase();
    const lowerSnippet = r.snippet.toLowerCase();
    const productIndicators = [
      'pricing', 'features', 'demo', 'free trial', 'sign up',
      'software', 'tool', 'platform', 'solution', 'app',
    ];

    return productIndicators.some(ind =>
      lowerTitle.includes(ind) || lowerSnippet.includes(ind)
    );
  });
}

/**
 * Build the AI prompt for competitor analysis
 */
function buildAnalysisPrompt(
  problemStatement: string,
  results: SearchResult[]
): string {
  const resultsText = results
    .slice(0, 15)
    .map((r, i) => `${i + 1}. "${r.title}" - ${r.url}\n   ${r.snippet}`)
    .join('\n\n');

  return `Analyze these search results to identify competitors and market gaps for this problem:

PROBLEM: ${problemStatement}

SEARCH RESULTS:
${resultsText}

Analyze these results and provide:

1. COMPETITORS: List up to 5 relevant competitors/solutions found. For each include:
   - name: Product/company name
   - url: Website URL
   - description: What they do (1-2 sentences)
   - pricing: Pricing model if mentioned (free, freemium, paid, enterprise, unknown)
   - strengths: 2-3 key strengths
   - weaknesses: 2-3 potential weaknesses or limitations

2. GAPS: List 3-5 unmet needs or gaps in the current solutions

3. MARKET_OPPORTUNITY: Rate as "high", "medium", "low", or "saturated"
   - high: Few competitors, clear unmet needs
   - medium: Some competitors but room for differentiation
   - low: Many competitors, incremental improvements possible
   - saturated: Crowded market, difficult to differentiate

4. DIFFERENTIATION_ANGLES: List 2-4 ways a new solution could differentiate

5. ANALYSIS_NOTES: Brief summary of the competitive landscape (2-3 sentences)

Respond with valid JSON matching this structure:
{
  "competitors": [...],
  "gaps": [...],
  "marketOpportunity": "high|medium|low|saturated",
  "differentiationAngles": [...],
  "analysisNotes": "..."
}`;
}

/**
 * Parse AI response into CompetitorAnalysis
 */
function parseAnalysisResponse(responseText: string): CompetitorAnalysis {
  // Try to extract JSON from the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    competitors?: Array<{
      name?: string;
      url?: string;
      description?: string;
      pricing?: string;
      strengths?: string[];
      weaknesses?: string[];
    }>;
    gaps?: string[];
    marketOpportunity?: string;
    differentiationAngles?: string[];
    analysisNotes?: string;
  };

  // Validate and normalize
  const competitors: Competitor[] = (parsed.competitors || []).map(c => ({
    name: c.name || 'Unknown',
    url: c.url || '',
    description: c.description || '',
    pricing: c.pricing || 'unknown',
    strengths: Array.isArray(c.strengths) ? c.strengths : [],
    weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
  }));

  const opportunity = parsed.marketOpportunity?.toLowerCase();
  const validOpportunities = ['high', 'medium', 'low', 'saturated'] as const;
  const marketOpportunity = validOpportunities.includes(opportunity as typeof validOpportunities[number])
    ? (opportunity as 'high' | 'medium' | 'low' | 'saturated')
    : 'medium';

  return {
    competitors,
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    marketOpportunity,
    differentiationAngles: Array.isArray(parsed.differentiationAngles)
      ? parsed.differentiationAngles
      : [],
    analysisNotes: parsed.analysisNotes || '',
  };
}

/**
 * Create a fallback analysis when AI is not available
 */
export function createFallbackAnalysis(results: SearchResult[]): CompetitorAnalysis {
  const productResults = filterProductResults(results);

  // Extract competitor names from titles
  const competitors: Competitor[] = productResults.slice(0, 5).map(r => {
    // Try to extract product name from title
    const titleParts = r.title.split(/[-|:–]/);
    const name = titleParts[0]?.trim() || r.domain;

    return {
      name,
      url: r.url,
      description: r.snippet.slice(0, 200),
      pricing: 'unknown',
      strengths: ['Established presence'],
      weaknesses: ['Unable to determine from search results'],
    };
  });

  // Determine market opportunity based on result count
  let marketOpportunity: 'high' | 'medium' | 'low' | 'saturated';
  if (productResults.length <= 2) {
    marketOpportunity = 'high';
  } else if (productResults.length <= 5) {
    marketOpportunity = 'medium';
  } else if (productResults.length <= 8) {
    marketOpportunity = 'low';
  } else {
    marketOpportunity = 'saturated';
  }

  return {
    competitors,
    gaps: ['Further analysis needed - AI not available'],
    marketOpportunity,
    differentiationAngles: ['Requires manual competitive analysis'],
    analysisNotes: `Found ${productResults.length} potential competitors. Manual analysis recommended.`,
  };
}

/**
 * Analyze competitors using Anthropic Claude
 */
export async function analyzeCompetitors(
  problemStatement: string,
  searchResults: SearchResult[],
  options: CompetitorAnalysisOptions = {}
): Promise<CompetitorAnalysis> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    anthropicApiKey: options.anthropicApiKey || config.ANTHROPIC_API_KEY,
  };

  // Filter to relevant results
  const relevantResults = searchResults.slice(0, 15);

  // If no API key, return fallback analysis
  if (!opts.anthropicApiKey) {
    logger.warn('No Anthropic API key available, using fallback analysis');
    return createFallbackAnalysis(relevantResults);
  }

  const prompt = buildAnalysisPrompt(problemStatement, relevantResults);

  try {
    const result = await callAnthropicApi({
      apiKey: opts.anthropicApiKey,
      model: opts.model,
      system: 'You are a market research analyst. Analyze search results to identify competitors, market gaps, and opportunities. Always respond with valid JSON.',
      prompt,
      maxTokens: 2000,
      module: 'competitor',
    });

    return parseAnalysisResponse(result.text);
  } catch (error) {
    logger.warn({ err: error }, 'Error analyzing competitors');
    return createFallbackAnalysis(relevantResults);
  }
}

/**
 * Calculate a competition score (0-100)
 * Higher = more competition
 */
export function calculateCompetitionScore(analysis: CompetitorAnalysis): number {
  let score = 0;

  // Base score from competitor count
  score += Math.min(analysis.competitors.length * 15, 60);

  // Adjust for market opportunity
  switch (analysis.marketOpportunity) {
    case 'saturated':
      score += 40;
      break;
    case 'low':
      score += 25;
      break;
    case 'medium':
      score += 10;
      break;
    case 'high':
      score += 0;
      break;
  }

  return Math.min(score, 100);
}

// Batch analysis constants
const BATCH_SIZE = 20;

/**
 * Build prompt for analyzing competitors for multiple problems in one call
 */
function buildBatchCompetitorPrompt(
  problems: Array<{ statement: string; results: SearchResult[] }>
): string {
  const problemsList = problems
    .map(
      (p, i) => `
## Problem ${i + 1}
Statement: ${p.statement}
Search Results:
${p.results
  .slice(0, 10)
  .map((r, j) => `${j + 1}. "${r.title}" - ${r.url}\n   ${r.snippet}`)
  .join('\n')}`
    )
    .join('\n---\n');

  return `Analyze competitors for each of these ${problems.length} problems.

${problemsList}

For each problem, provide:
1. competitors: Array of up to 3 competitors found
2. gaps: Array of 2-3 unmet needs
3. marketOpportunity: "high" | "medium" | "low" | "saturated"
4. differentiationAngles: 2-3 ways to differentiate
5. analysisNotes: 1-2 sentence summary

Respond with a JSON array. Each element should have:
- problemIndex (0-based)
- competitors (array with name, url, description, pricing, strengths, weaknesses)
- gaps (array of strings)
- marketOpportunity (string)
- differentiationAngles (array of strings)
- analysisNotes (string)

Example response format:
[
  {
    "problemIndex": 0,
    "competitors": [{"name": "...", "url": "...", "description": "...", "pricing": "...", "strengths": [...], "weaknesses": [...]}],
    "gaps": ["..."],
    "marketOpportunity": "medium",
    "differentiationAngles": ["..."],
    "analysisNotes": "..."
  }
]`;
}

/**
 * Parse batch competitor response from AI
 */
function parseBatchCompetitorResponse(
  responseText: string,
  problemIds: string[]
): Map<string, CompetitorAnalysis> {
  const results = new Map<string, CompetitorAnalysis>();

  try {
    // Try to extract JSON array from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      problemIndex?: number;
      competitors?: Array<{
        name?: string;
        url?: string;
        description?: string;
        pricing?: string;
        strengths?: string[];
        weaknesses?: string[];
      }>;
      gaps?: string[];
      marketOpportunity?: string;
      differentiationAngles?: string[];
      analysisNotes?: string;
    }>;

    for (const item of parsed) {
      const index = item.problemIndex ?? -1;
      if (index < 0 || index >= problemIds.length) continue;

      const problemId = problemIds[index];

      // Normalize competitors
      const competitors: Competitor[] = (item.competitors || []).map(c => ({
        name: c.name || 'Unknown',
        url: c.url || '',
        description: c.description || '',
        pricing: c.pricing || 'unknown',
        strengths: Array.isArray(c.strengths) ? c.strengths : [],
        weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
      }));

      // Normalize market opportunity
      const opportunity = item.marketOpportunity?.toLowerCase();
      const validOpportunities = ['high', 'medium', 'low', 'saturated'] as const;
      const marketOpportunity = validOpportunities.includes(
        opportunity as (typeof validOpportunities)[number]
      )
        ? (opportunity as 'high' | 'medium' | 'low' | 'saturated')
        : 'medium';

      results.set(problemId, {
        competitors,
        gaps: Array.isArray(item.gaps) ? item.gaps : [],
        marketOpportunity,
        differentiationAngles: Array.isArray(item.differentiationAngles)
          ? item.differentiationAngles
          : [],
        analysisNotes: item.analysisNotes || '',
      });
    }
  } catch (error) {
    logger.warn({ err: error }, 'Failed to parse batch response');
  }

  return results;
}

/**
 * Analyze competitors for multiple problems in one API call
 * Batches up to BATCH_SIZE problems per call for cost efficiency
 */
export async function analyzeCompetitorsBatch(
  problems: Array<{
    id: string;
    statement: string;
    results: SearchResult[];
  }>,
  options: CompetitorAnalysisOptions = {}
): Promise<Map<string, CompetitorAnalysis>> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    anthropicApiKey: options.anthropicApiKey || config.ANTHROPIC_API_KEY,
  };

  const allResults = new Map<string, CompetitorAnalysis>();

  // If no API key, return fallback for all problems
  if (!opts.anthropicApiKey) {
    logger.warn('No Anthropic API key available, using fallback analysis for batch');
    for (const p of problems) {
      allResults.set(p.id, createFallbackAnalysis(p.results));
    }
    return allResults;
  }

  const systemPrompt = 'You are a market research analyst. Analyze search results to identify competitors and market gaps. Always respond with valid JSON.';

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < problems.length; i += BATCH_SIZE) {
    const batch = problems.slice(i, i + BATCH_SIZE);
    const problemIds = batch.map(p => p.id);

    const prompt = buildBatchCompetitorPrompt(
      batch.map(p => ({ statement: p.statement, results: p.results }))
    );

    try {
      const result = await callAnthropicApi({
        apiKey: opts.anthropicApiKey,
        model: opts.model,
        system: systemPrompt,
        prompt,
        maxTokens: 6000,
        module: 'competitor',
        batchSize: batch.length,
      });

      const batchResults = parseBatchCompetitorResponse(result.text, problemIds);

      // Merge results and add fallbacks for any missing
      for (const p of batch) {
        if (batchResults.has(p.id)) {
          allResults.set(p.id, batchResults.get(p.id)!);
        } else {
          allResults.set(p.id, createFallbackAnalysis(p.results));
        }
      }
    } catch (error) {
      logger.warn({ err: error }, 'Batch competitor analysis failed, using fallbacks');
      for (const p of batch) {
        allResults.set(p.id, createFallbackAnalysis(p.results));
      }
    }
  }

  return allResults;
}

/**
 * Summarize competitor analysis in plain text
 */
export function summarizeAnalysis(analysis: CompetitorAnalysis): string {
  const lines: string[] = [];

  lines.push(`Market Opportunity: ${analysis.marketOpportunity.toUpperCase()}`);
  lines.push(`Found ${analysis.competitors.length} competitor(s)`);

  if (analysis.competitors.length > 0) {
    lines.push('\nTop Competitors:');
    analysis.competitors.slice(0, 3).forEach((c, i) => {
      lines.push(`${i + 1}. ${c.name} - ${c.description.slice(0, 100)}`);
    });
  }

  if (analysis.gaps.length > 0) {
    lines.push('\nKey Gaps:');
    analysis.gaps.slice(0, 3).forEach((g, i) => {
      lines.push(`- ${g}`);
    });
  }

  if (analysis.differentiationAngles.length > 0) {
    lines.push('\nDifferentiation Opportunities:');
    analysis.differentiationAngles.slice(0, 3).forEach(d => {
      lines.push(`- ${d}`);
    });
  }

  return lines.join('\n');
}
