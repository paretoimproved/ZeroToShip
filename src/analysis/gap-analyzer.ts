/**
 * Gap Analyzer Module for IdeaForge
 *
 * For each problem cluster, searches for existing solutions,
 * analyzes competitors, and identifies market gaps and opportunities.
 *
 * NOTE: This module takes ProblemCluster as input (not ScoredProblem),
 * enabling parallel execution with the Scorer module.
 */

import type { ProblemCluster } from './deduplicator';
import {
  WebSearchClient,
  generateSearchQueries,
  type SearchResponse,
  type WebSearchConfig,
} from './web-search';
import {
  analyzeCompetitors,
  calculateCompetitionScore,
  summarizeAnalysis,
  type Competitor,
  type CompetitorAnalysis,
  type CompetitorAnalysisOptions,
} from './competitor';

/**
 * Complete gap analysis for a problem
 */
export interface GapAnalysis {
  problemId: string;
  problemStatement: string;
  searchQueries: string[];
  existingSolutions: Competitor[];
  gaps: string[];
  marketOpportunity: 'high' | 'medium' | 'low' | 'saturated';
  differentiationAngles: string[];
  recommendation: string;
  competitionScore: number;
  analysisNotes: string;
  analyzedAt: Date;
}

/**
 * Configuration for gap analysis
 */
export interface GapAnalysisConfig {
  webSearch?: WebSearchConfig;
  competitor?: CompetitorAnalysisOptions;
  concurrency?: number;
  skipSearchForLowFrequency?: boolean;
  minFrequencyForSearch?: number;
}

const DEFAULT_CONFIG: Required<GapAnalysisConfig> = {
  webSearch: {
    provider: 'auto',
    maxResults: 10,
    rateLimitDelay: 1000,
  },
  competitor: {
    model: 'gpt-4o-mini',
    maxCompetitors: 10,
  },
  concurrency: 2,
  skipSearchForLowFrequency: true,
  minFrequencyForSearch: 2,
};

/**
 * Generate recommendation based on analysis
 */
function generateRecommendation(
  analysis: CompetitorAnalysis,
  problemFrequency: number
): string {
  const competitorCount = analysis.competitors.length;
  const opportunity = analysis.marketOpportunity;

  // High opportunity scenarios
  if (opportunity === 'high') {
    if (problemFrequency >= 5) {
      return 'STRONG OPPORTUNITY: High demand with few competitors. Consider building an MVP quickly to capture early market share.';
    }
    return 'PROMISING: Few competitors exist. Validate demand further before committing significant resources.';
  }

  // Medium opportunity scenarios
  if (opportunity === 'medium') {
    if (analysis.gaps.length >= 3) {
      return 'VIABLE WITH DIFFERENTIATION: Market has competitors but clear gaps exist. Focus on underserved niches or specific user segments.';
    }
    return 'PROCEED WITH CAUTION: Competition exists. Need strong differentiation strategy and unique value proposition.';
  }

  // Low opportunity scenarios
  if (opportunity === 'low') {
    if (analysis.differentiationAngles.length >= 2) {
      return 'CHALLENGING: Crowded market. Only pursue if you have unique expertise or technology advantage.';
    }
    return 'NOT RECOMMENDED: Established competitors dominate. Consider pivoting to a related but less competitive niche.';
  }

  // Saturated market
  if (opportunity === 'saturated') {
    return 'AVOID: Market is saturated with solutions. Extremely difficult to gain traction without massive differentiation or resources.';
  }

  return 'REQUIRES FURTHER ANALYSIS: Unable to determine clear recommendation.';
}

/**
 * Analyze gaps for a single problem cluster
 */
export async function analyzeGaps(
  problem: ProblemCluster,
  config: GapAnalysisConfig = {}
): Promise<GapAnalysis> {
  const opts = {
    ...DEFAULT_CONFIG,
    ...config,
    webSearch: { ...DEFAULT_CONFIG.webSearch, ...config.webSearch },
    competitor: { ...DEFAULT_CONFIG.competitor, ...config.competitor },
  };

  // Check if we should skip search for low-frequency problems
  if (opts.skipSearchForLowFrequency && problem.frequency < opts.minFrequencyForSearch) {
    return {
      problemId: problem.id,
      problemStatement: problem.problemStatement,
      searchQueries: [],
      existingSolutions: [],
      gaps: ['Skipped - low frequency problem'],
      marketOpportunity: 'medium',
      differentiationAngles: [],
      recommendation: 'SKIPPED: Problem frequency too low for detailed analysis. Monitor for increased mentions.',
      competitionScore: 0,
      analysisNotes: `Skipped analysis for problem with frequency ${problem.frequency} (threshold: ${opts.minFrequencyForSearch})`,
      analyzedAt: new Date(),
    };
  }

  // Generate search queries
  const searchQueries = generateSearchQueries(problem.problemStatement);

  // Initialize web search client
  const searchClient = new WebSearchClient(opts.webSearch);

  // Execute searches
  let searchResponses: SearchResponse[] = [];
  try {
    searchResponses = await searchClient.searchForProblem(problem.problemStatement);
  } catch (error) {
    console.warn(`Search failed for problem ${problem.id}:`, error);
  }

  // Deduplicate search results
  const allResults = WebSearchClient.deduplicateResults(searchResponses);

  // Analyze competitors
  const competitorAnalysis = await analyzeCompetitors(
    problem.problemStatement,
    allResults,
    opts.competitor
  );

  // Calculate competition score
  const competitionScore = calculateCompetitionScore(competitorAnalysis);

  // Generate recommendation
  const recommendation = generateRecommendation(competitorAnalysis, problem.frequency);

  return {
    problemId: problem.id,
    problemStatement: problem.problemStatement,
    searchQueries,
    existingSolutions: competitorAnalysis.competitors,
    gaps: competitorAnalysis.gaps,
    marketOpportunity: competitorAnalysis.marketOpportunity,
    differentiationAngles: competitorAnalysis.differentiationAngles,
    recommendation,
    competitionScore,
    analysisNotes: competitorAnalysis.analysisNotes,
    analyzedAt: new Date(),
  };
}

/**
 * Analyze gaps for multiple problem clusters
 * Processes in batches to respect rate limits
 */
export async function analyzeAllGaps(
  problems: ProblemCluster[],
  config: GapAnalysisConfig = {}
): Promise<GapAnalysis[]> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const results: GapAnalysis[] = [];

  console.log(`Starting gap analysis for ${problems.length} problems...`);

  // Process in batches based on concurrency
  for (let i = 0; i < problems.length; i += opts.concurrency) {
    const batch = problems.slice(i, i + opts.concurrency);

    const batchPromises = batch.map(problem =>
      analyzeGaps(problem, config).catch(error => {
        console.error(`Failed to analyze problem ${problem.id}:`, error);
        // Return a minimal result on error
        return {
          problemId: problem.id,
          problemStatement: problem.problemStatement,
          searchQueries: [],
          existingSolutions: [],
          gaps: ['Analysis failed - see logs'],
          marketOpportunity: 'medium' as const,
          differentiationAngles: [],
          recommendation: 'ERROR: Analysis failed. Manual research recommended.',
          competitionScore: 0,
          analysisNotes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          analyzedAt: new Date(),
        };
      })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(`Completed ${Math.min(i + opts.concurrency, problems.length)}/${problems.length} problems`);
  }

  console.log(`Gap analysis complete for ${results.length} problems`);
  return results;
}

/**
 * Filter gap analyses by market opportunity
 */
export function filterByOpportunity(
  analyses: GapAnalysis[],
  minOpportunity: 'high' | 'medium' | 'low' | 'saturated'
): GapAnalysis[] {
  const opportunityRank = {
    high: 4,
    medium: 3,
    low: 2,
    saturated: 1,
  };

  const minRank = opportunityRank[minOpportunity];

  return analyses.filter(a => opportunityRank[a.marketOpportunity] >= minRank);
}

/**
 * Sort gap analyses by opportunity score
 * Combines market opportunity and competition score
 */
export function sortByOpportunity(analyses: GapAnalysis[]): GapAnalysis[] {
  const opportunityScore = {
    high: 100,
    medium: 60,
    low: 30,
    saturated: 10,
  };

  return [...analyses].sort((a, b) => {
    // Primary: market opportunity
    const aOpp = opportunityScore[a.marketOpportunity];
    const bOpp = opportunityScore[b.marketOpportunity];

    if (aOpp !== bOpp) return bOpp - aOpp;

    // Secondary: lower competition score is better
    return a.competitionScore - b.competitionScore;
  });
}

/**
 * Get summary statistics for gap analyses
 */
export function getGapAnalysisStats(analyses: GapAnalysis[]): {
  total: number;
  byOpportunity: Record<string, number>;
  averageCompetitionScore: number;
  topOpportunities: Array<{ id: string; statement: string; opportunity: string }>;
} {
  const byOpportunity: Record<string, number> = {
    high: 0,
    medium: 0,
    low: 0,
    saturated: 0,
  };

  let totalCompetitionScore = 0;

  for (const analysis of analyses) {
    byOpportunity[analysis.marketOpportunity]++;
    totalCompetitionScore += analysis.competitionScore;
  }

  const sorted = sortByOpportunity(analyses);

  return {
    total: analyses.length,
    byOpportunity,
    averageCompetitionScore: analyses.length > 0
      ? totalCompetitionScore / analyses.length
      : 0,
    topOpportunities: sorted.slice(0, 5).map(a => ({
      id: a.problemId,
      statement: a.problemStatement,
      opportunity: a.marketOpportunity,
    })),
  };
}

/**
 * Export gap analysis results to JSON
 */
export function exportGapAnalyses(analyses: GapAnalysis[]): string {
  return JSON.stringify(
    analyses.map(a => ({
      problemId: a.problemId,
      problemStatement: a.problemStatement,
      marketOpportunity: a.marketOpportunity,
      competitionScore: a.competitionScore,
      recommendation: a.recommendation,
      competitorCount: a.existingSolutions.length,
      gapCount: a.gaps.length,
      analyzedAt: a.analyzedAt.toISOString(),
    })),
    null,
    2
  );
}

/**
 * Format a single gap analysis as markdown
 */
export function formatGapAnalysisMarkdown(analysis: GapAnalysis): string {
  const lines: string[] = [];

  lines.push(`## ${analysis.problemStatement}`);
  lines.push('');
  lines.push(`**Market Opportunity:** ${analysis.marketOpportunity.toUpperCase()}`);
  lines.push(`**Competition Score:** ${analysis.competitionScore}/100`);
  lines.push('');
  lines.push(`### Recommendation`);
  lines.push(analysis.recommendation);
  lines.push('');

  if (analysis.existingSolutions.length > 0) {
    lines.push(`### Existing Solutions (${analysis.existingSolutions.length})`);
    for (const solution of analysis.existingSolutions) {
      lines.push(`- **${solution.name}** - ${solution.description}`);
      if (solution.strengths.length > 0) {
        lines.push(`  - Strengths: ${solution.strengths.join(', ')}`);
      }
      if (solution.weaknesses.length > 0) {
        lines.push(`  - Weaknesses: ${solution.weaknesses.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (analysis.gaps.length > 0) {
    lines.push('### Market Gaps');
    for (const gap of analysis.gaps) {
      lines.push(`- ${gap}`);
    }
    lines.push('');
  }

  if (analysis.differentiationAngles.length > 0) {
    lines.push('### Differentiation Opportunities');
    for (const angle of analysis.differentiationAngles) {
      lines.push(`- ${angle}`);
    }
    lines.push('');
  }

  if (analysis.analysisNotes) {
    lines.push('### Analysis Notes');
    lines.push(analysis.analysisNotes);
    lines.push('');
  }

  return lines.join('\n');
}
