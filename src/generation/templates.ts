/**
 * Prompt Templates for Business Brief Generation
 *
 * Templates for GPT-4 to generate comprehensive startup briefs
 * from scored problems and gap analyses.
 */

import type { ScoredProblem } from '../analysis/scorer';
import type { GapAnalysis } from '../analysis/gap-analyzer';
import type { TechStackRecommendation, EffortLevel } from './tech-stacks';
import logger from '../lib/logger';

/**
 * System prompt for brief generation
 */
export const BRIEF_SYSTEM_PROMPT = `You are a startup advisor and technical architect helping entrepreneurs identify and validate business opportunities.

Your role is to analyze problems people are experiencing (gathered from Reddit, Hacker News, Twitter, and GitHub issues) and create actionable business briefs for indie hackers and startup founders.

Guidelines:
- Be specific and actionable, not generic
- Ground recommendations in the actual problem data provided
- Provide realistic revenue estimates based on market size
- Suggest concrete marketing channels and first customer acquisition strategies
- Include specific tech recommendations suitable for the project scope
- Identify 3-5 concrete risks with mitigations
- Write in a direct, no-fluff style
- CRITICAL: Every field must contain specific, substantive content. Do not leave any field empty or with placeholder text like "TBD" or "To be determined".

Output format: Return valid JSON matching the requested schema. Do not include markdown code blocks.`;

/**
 * Build the main brief generation prompt
 */
export function buildBriefPrompt(
  problem: ScoredProblem,
  gaps: GapAnalysis,
  stackRecommendation: TechStackRecommendation,
  effortLevel: EffortLevel
): string {
  const competitorList = gaps.existingSolutions
    .slice(0, 5)
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  const gapsList = gaps.gaps
    .slice(0, 5)
    .map(g => `- ${g}`)
    .join('\n');

  const differentiationList = gaps.differentiationAngles
    .slice(0, 5)
    .map(d => `- ${d}`)
    .join('\n');

  const sourcesList = problem.sources.join(', ');

  return `Generate a comprehensive business brief for the following startup opportunity.

## Problem Data

**Problem Statement:** ${problem.problemStatement}

**Signal Strength:**
- Frequency: ${problem.frequency} mentions across ${problem.sources.length} sources (${sourcesList})
- Community Validation: ${problem.scores.engagement.toFixed(1)}/10
- Priority Score: ${problem.scores.priority.toFixed(2)}
- Impact Score: ${problem.scores.impact.toFixed(2)}
- Effort Score: ${problem.scores.effort.toFixed(2)}

**Representative Post:**
- Source: ${problem.representativePost.source}
- Title: ${problem.representativePost.title}
- URL: ${problem.representativePost.url}
- Score: ${problem.representativePost.score} upvotes, ${problem.representativePost.commentCount} comments

## Competitive Landscape

**Market Opportunity:** ${gaps.marketOpportunity.toUpperCase()}
**Competition Score:** ${gaps.competitionScore}/100

**Existing Solutions:**
${competitorList || 'None identified'}

**Market Gaps:**
${gapsList || 'No specific gaps identified'}

**Differentiation Opportunities:**
${differentiationList || 'None identified'}

**Recommendation:** ${gaps.recommendation}

## Constraints

**Effort Level:** ${effortLevel}
**Suggested Tech Stack:** ${stackRecommendation.stack.join(', ')}
**Architecture:** ${stackRecommendation.architecture}
**Estimated Hosting Cost:** ${stackRecommendation.estimatedCost}

## Output Requirements

Generate a JSON object with these exact fields:

{
  "name": "Product name (catchy, memorable, 1-2 words)",
  "tagline": "One-line value proposition (under 10 words)",
  "problemStatement": "Refined problem statement (1-2 sentences)",
  "targetAudience": "Specific target persona with demographics",
  "marketSize": "TAM/SAM/SOM estimates with reasoning",
  "existingSolutions": "Summary of current alternatives and their limitations",
  "gaps": "Key unmet needs the market has",
  "proposedSolution": "Your unique solution approach (2-3 sentences)",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
  "mvpScope": "Minimum features for launch (be ruthless)",
  "architecture": "Technical architecture overview",
  "pricing": "Pricing strategy with specific tiers",
  "revenueProjection": "Year 1-3 revenue potential",
  "monetizationPath": "Primary revenue model and upsell paths",
  "launchStrategy": "Specific launch plan (where, how, timeline)",
  "channels": ["Channel 1", "Channel 2", "Channel 3"],
  "firstCustomers": "How to get first 10 paying customers",
  "risks": ["Risk 1 with mitigation", "Risk 2 with mitigation", "Risk 3 with mitigation"]
}

Important: Return ONLY the JSON object, no markdown formatting or code blocks.`;
}

/**
 * Prompt for generating just the name and tagline
 */
export function buildNamePrompt(problem: ScoredProblem): string {
  return `Generate a catchy product name and tagline for a startup solving this problem:

"${problem.problemStatement}"

Requirements:
- Name: 1-2 words, memorable, available as .com or .io (suggest variations)
- Tagline: Under 10 words, clear value proposition

Return JSON: {"name": "ProductName", "tagline": "Your value prop here", "domainSuggestions": ["name.com", "name.io", "getname.com"]}`;
}

/**
 * Prompt for validating/expanding business model
 */
export function buildBusinessModelPrompt(
  problem: ScoredProblem,
  gaps: GapAnalysis
): string {
  return `Analyze the business model potential for a solution to this problem:

**Problem:** ${problem.problemStatement}
**Market Opportunity:** ${gaps.marketOpportunity}
**Existing Competitors:** ${gaps.existingSolutions.length}
**Key Gaps:** ${gaps.gaps.join('; ')}

Provide detailed analysis:

1. **Revenue Models** (rank by fit):
   - SaaS subscription
   - Usage-based pricing
   - Freemium
   - One-time purchase
   - Marketplace/transaction fees
   - API pricing

2. **Pricing Strategy:**
   - Free tier scope
   - Paid tier pricing ($X/month)
   - Enterprise pricing approach

3. **Revenue Projection:**
   - Conservative Year 1
   - Moderate Year 2
   - Optimistic Year 3
   - Key assumptions

Return JSON with fields: preferredModel, pricingTiers, yearlyProjections, assumptions`;
}

/**
 * Prompt for go-to-market strategy
 */
export function buildGTMPrompt(
  problem: ScoredProblem,
  gaps: GapAnalysis
): string {
  const sources = problem.sources;

  return `Create a go-to-market strategy for a startup solving:

"${problem.problemStatement}"

**Where the problem was found:** ${sources.join(', ')}
**Market opportunity:** ${gaps.marketOpportunity}
**Differentiation angles:** ${gaps.differentiationAngles.join('; ')}

Provide:

1. **Pre-Launch (Week 1-2):**
   - Landing page strategy
   - Waitlist building tactics
   - Community engagement

2. **Launch (Week 3-4):**
   - Primary launch channels (be specific: which subreddits, HN strategy, etc.)
   - Launch day tactics
   - PR/content strategy

3. **Post-Launch (Month 2-3):**
   - Growth loops
   - Content marketing
   - Referral strategy

4. **First 10 Customers:**
   - Exact steps to acquire them
   - Pricing for early adopters
   - Feedback collection

Return JSON with fields: preLaunch, launch, postLaunch, first10Customers`;
}

/**
 * Prompt for risk analysis
 */
export function buildRiskPrompt(
  problem: ScoredProblem,
  gaps: GapAnalysis
): string {
  return `Identify risks and mitigations for a startup solving:

"${problem.problemStatement}"

**Competition level:** ${gaps.competitionScore}/100
**Market opportunity:** ${gaps.marketOpportunity}
**Competitors:** ${gaps.existingSolutions.map(c => c.name).join(', ') || 'Unknown'}

Analyze these risk categories:

1. **Market Risks** (demand validation, timing, competition)
2. **Technical Risks** (complexity, dependencies, scalability)
3. **Business Risks** (monetization, CAC, churn)
4. **Execution Risks** (team, resources, timeline)

For each risk:
- Likelihood: High/Medium/Low
- Impact: High/Medium/Low
- Mitigation strategy

Return JSON array: [{"category": "...", "risk": "...", "likelihood": "...", "impact": "...", "mitigation": "..."}]`;
}

/**
 * Parse GPT response as JSON
 */
export function parseJsonResponse<T>(response: string): T | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    return JSON.parse(cleaned) as T;
  } catch (firstError) {
    // Attempt to fix truncated JSON by closing unclosed brackets/braces
    try {
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Remove any trailing comma before we close brackets
      cleaned = cleaned.replace(/,\s*$/, '');

      // Count unclosed brackets and braces
      let openBraces = 0;
      let openBrackets = 0;
      let inString = false;
      let escapeNext = false;

      for (const char of cleaned) {
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
      }

      // If we're inside a string, close it
      if (inString) {
        cleaned += '"';
      }

      // Close any unclosed braces/brackets
      for (let i = 0; i < openBraces; i++) cleaned += '}';
      for (let i = 0; i < openBrackets; i++) cleaned += ']';

      if (openBraces > 0 || openBrackets > 0 || inString) {
        const result = JSON.parse(cleaned) as T;
        logger.info({ fixedBraces: openBraces, fixedBrackets: openBrackets }, 'Recovered truncated JSON response');
        return result;
      }

      // If no structural fixes were needed, the JSON is truly invalid
      logger.warn({ err: firstError, rawResponse: response.slice(0, 200) }, 'Failed to parse JSON response');
      return null;
    } catch (recoveryError) {
      logger.warn({ err: firstError, rawResponse: response.slice(0, 200) }, 'Failed to parse JSON response');
      return null;
    }
  }
}

/**
 * Effort level to readable string
 */
export function effortToString(effortLevel: EffortLevel): string {
  const mapping: Record<EffortLevel, string> = {
    weekend: 'a weekend hackathon (2-3 days)',
    week: 'a focused week (5-7 days)',
    month: 'a dedicated month (4 weeks)',
    quarter: 'a full quarter (3 months)',
  };
  return mapping[effortLevel];
}

/**
 * Map scores to effort level
 */
export function scoreToEffortLevel(scores: { timeToMvp: number; technicalComplexity: number }): EffortLevel {
  const effort = scores.timeToMvp * scores.technicalComplexity;

  if (effort <= 6) return 'weekend';
  if (effort <= 16) return 'week';
  if (effort <= 36) return 'month';
  return 'quarter';
}

/**
 * Build a batch brief generation prompt for multiple problems
 */
export function buildBatchBriefPrompt(
  problems: Array<{
    id: string;
    problem: ScoredProblem;
    gaps: GapAnalysis;
    stackRecommendation: { stack: string[]; architecture: string; estimatedCost: string };
    effortLevel: EffortLevel;
  }>
): string {
  const problemsData = problems.map((p, index) => {
    const competitorList = p.gaps.existingSolutions
      .slice(0, 5)
      .map(c => `${c.name}: ${c.description}`)
      .join('; ');

    const gapsList = p.gaps.gaps.slice(0, 5).join('; ');

    return `
### Problem ${index + 1} (ID: ${p.id})
**Statement:** ${p.problem.problemStatement}
**Priority Score:** ${p.problem.scores.priority.toFixed(2)}
**Community Validation:** ${p.problem.scores.engagement.toFixed(1)}/10
**Frequency:** ${p.problem.frequency} mentions across ${p.problem.sources.join(', ')}
**Market Opportunity:** ${p.gaps.marketOpportunity}
**Competition:** ${competitorList || 'None identified'}
**Gaps:** ${gapsList || 'None identified'}
**Differentiation:** ${p.gaps.differentiationAngles.slice(0, 3).join('; ') || 'None identified'}
**Architecture:** ${p.stackRecommendation.architecture}
**Estimated Cost:** ${p.stackRecommendation.estimatedCost}
**Effort Level:** ${p.effortLevel}
**Suggested Stack:** ${p.stackRecommendation.stack.join(', ')}`;
  }).join('\n');

  return `Generate business briefs for the following ${problems.length} startup opportunities.

${problemsData}

## Output Requirements

Return a JSON array with ${problems.length} briefs, one for each problem above. Each brief should have these fields:

[
  {
    "id": "problem_id from above",
    "name": "Product name (1-2 words)",
    "tagline": "One-line value proposition (under 10 words)",
    "problemStatement": "Refined problem statement",
    "targetAudience": "Target persona",
    "marketSize": "TAM/SAM/SOM estimates",
    "existingSolutions": "Current alternatives summary",
    "gaps": "Key unmet needs",
    "proposedSolution": "Your solution approach",
    "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"],
    "mvpScope": "Minimum features for launch",
    "architecture": "Technical architecture",
    "pricing": "Pricing strategy",
    "revenueProjection": "Year 1-3 revenue potential",
    "monetizationPath": "Revenue model",
    "launchStrategy": "Launch plan",
    "channels": ["Channel 1", "Channel 2"],
    "firstCustomers": "How to get first 10 customers",
    "risks": ["Risk 1", "Risk 2", "Risk 3"]
  }
]

CRITICAL: Every field in every brief must contain specific, substantive content. Do not use placeholder text like "TBD", "To be determined", or "Research required". Base all content on the problem data provided above.

Important: Return ONLY the JSON array with ${problems.length} objects, no markdown or code blocks.`;
}
