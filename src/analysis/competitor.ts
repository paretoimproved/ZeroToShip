/**
 * Competitor Analysis Module for Gap Analysis
 *
 * Uses AI to analyze search results and identify competitors,
 * their strengths, weaknesses, and market positioning.
 */

import type { SearchResult } from './web-search';

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
  openaiApiKey?: string;
  model?: string;
  maxCompetitors?: number;
}

const DEFAULT_OPTIONS: Required<CompetitorAnalysisOptions> = {
  openaiApiKey: '',
  model: 'gpt-4o-mini',
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
 * Analyze competitors using OpenAI
 */
export async function analyzeCompetitors(
  problemStatement: string,
  searchResults: SearchResult[],
  options: CompetitorAnalysisOptions = {}
): Promise<CompetitorAnalysis> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    openaiApiKey: options.openaiApiKey || process.env.OPENAI_API_KEY || '',
  };

  // Filter to relevant results
  const relevantResults = searchResults.slice(0, 15);

  // If no API key, return fallback analysis
  if (!opts.openaiApiKey) {
    console.warn('No OpenAI API key available, using fallback analysis');
    return createFallbackAnalysis(relevantResults);
  }

  const prompt = buildAnalysisPrompt(problemStatement, relevantResults);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          {
            role: 'system',
            content: 'You are a market research analyst. Analyze search results to identify competitors, market gaps, and opportunities. Always respond with valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn(`OpenAI API error: ${response.status}, using fallback`);
      return createFallbackAnalysis(relevantResults);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.warn('Empty response from OpenAI, using fallback');
      return createFallbackAnalysis(relevantResults);
    }

    return parseAnalysisResponse(content);
  } catch (error) {
    console.warn('Error analyzing competitors:', error);
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
