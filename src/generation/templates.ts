/**
 * Prompt Templates for Business Brief Generation
 *
 * Templates for GPT-4 to generate comprehensive startup briefs
 * from scored problems and gap analyses.
 */

import type { ScoredProblem, EvidenceMetadata } from '../analysis/scorer';
import type { GapAnalysis } from '../analysis/gap-analyzer';
import type { TechStackRecommendation, EffortLevel } from './tech-stacks';
import { extractJson } from '../lib/json-parser';

/**
 * System prompt for brief generation
 */
export const BRIEF_SYSTEM_PROMPT = `You are a developer who scours community forums to find real problems worth building solutions for. You analyze real pain signals gathered from Reddit, Hacker News, and GitHub issues, then produce honest, evidence-calibrated assessments that developers can act on.

Guidelines:
- Be ruthlessly specific: name exact tools, APIs, frameworks, communities, and dollar amounts
- Ground every recommendation in the actual problem data provided — no hand-waving
- Provide realistic revenue projections with explicit subscriber/customer assumptions
- Specify concrete marketing channels with outreach templates and community targets
- Include system-design-level tech recommendations: frameworks, databases, key tables, API routes
- Identify 3-5 concrete risks with specific mitigations (not generic "market risk")
- Every field must be detailed enough for a headless agentic workflow to act on it
- CRITICAL: Every field must contain specific, substantive content. Do not leave any field empty or with placeholder text like "TBD" or "To be determined".

Format all text fields using markdown: use **bold** for key terms, bullet points for lists, ### headers for subsections, and tables where appropriate. This makes briefs scannable and actionable.

Output format: Return valid JSON matching the requested schema. Do not wrap the JSON in markdown code blocks.`;

export const SIGNAL_CARD_SYSTEM_PROMPT = `You spot early signals of developer pain points. Your job is to describe what you've found honestly — not to pitch, project revenue, or make promises. If the evidence is thin, say so.

Guidelines:
- Lead with what you observed in the data, not what you imagine could be
- Be specific about the problem, vague about the solution (the evidence doesn't support more)
- CRITICAL: Every field must contain specific, substantive content. Do not leave any field empty or with placeholder text like "TBD" or "To be determined".

Format all text fields using markdown where appropriate. Output format: Return valid JSON matching the requested schema. Do not wrap the JSON in markdown code blocks.`;

/**
 * Build the main brief generation prompt
 */
function buildEvidenceContext(meta: EvidenceMetadata): string {
  if (meta.tier === 'strong') {
    return `\n## Evidence Context\n\nEvidence is strong (${meta.sourceCount} sources across ${meta.platformCount} platforms, ${meta.totalEngagement} total engagement). Ground analysis in the specific data provided.`;
  }
  return `\n## Evidence Context\n\nEvidence is moderate (${meta.sourceCount} sources, ${meta.totalEngagement} engagement). Be measured in projections. Flag assumptions explicitly with 'ASSUMPTION:' prefix. If based on fewer than 5 signals, say 'Insufficient data for market sizing' for the estimatedOpportunity field.`;
}

export function buildBriefPrompt(
  problem: ScoredProblem,
  gaps: GapAnalysis,
  stackRecommendation: TechStackRecommendation,
  effortLevel: EffortLevel,
  evidenceMetadata?: EvidenceMetadata
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

  const evidenceSection = evidenceMetadata ? buildEvidenceContext(evidenceMetadata) : '';

  const isModerate = evidenceMetadata?.tier === 'moderate';
  const marketSizeField = isModerate
    ? `"estimatedOpportunity": "Estimated market opportunity. If fewer than 5 signals, write 'Insufficient data for market sizing'. Otherwise provide conservative estimates with explicit assumptions."`
    : `"marketSize": "TAM/SAM/SOM estimates. Use a markdown list or table with reasoning."`;
  const revenueField = isModerate
    ? `"revenueProjection": "Month 1/6/12/24 projections using a markdown table. Include 'ASSUMPTION:' prefix for each projection."`
    : `"revenueProjection": "Month 1/6/12/24 projections using a markdown table. Show subscriber counts and revenue. Include assumptions as bullet points."`;

  return `Generate a comprehensive business brief for the following startup opportunity.
${evidenceSection}

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
  "problemStatement": "Refined problem statement using markdown. Use **bold** for key pain points.",
  "targetAudience": "Target persona with demographics. Use bullet points for distinct segments.",
  ${marketSizeField},
  "existingSolutions": "Summary of current alternatives. Use bullet points with **competitor name**: limitation format.",
  "gaps": "Key unmet needs. Use bullet points for each gap.",
  "proposedSolution": "Concrete solution with specific implementation approach. Use **bold** for key terms, bullet points for components. Name exact tools, APIs, or data sources.",
  "keyFeatures": ["**Feature Name** — description with acceptance criteria and specific technical implementation (e.g., '**Webhook Ingestion** — Express endpoint that parses Slack event payloads and stores alerts in PostgreSQL'). Include 5 features, each as a markdown-formatted string."],
  "mvpScope": "Numbered list of exact screens/endpoints using markdown. Include ### Data Model subsection with key entities and ### API Routes subsection.",
  "architecture": "System design using markdown. Use ### subsections for Frontend, Backend, Database, External Services, Deployment. Include key tables and API routes.",
  "pricing": "Pricing tiers using a markdown table. Columns: Tier, Price, Features. Example: Free | $0 | 5 projects.",
  ${revenueField},
  "monetizationPath": "Primary revenue model and upsell paths using markdown. Use **bold** for key strategies.",
  "launchStrategy": "Week-by-week launch playbook using markdown. Use ### headers for Pre-Launch, Launch Day, Post-Launch phases.",
  "channels": ["Channel 1", "Channel 2", "Channel 3"],
  "firstCustomers": "Step-by-step playbook using markdown. Use numbered list with ### Where to Find, ### What to Say, ### How to Convert subsections.",
  "risks": ["**Risk name** — description with specific mitigation strategy", "**Risk 2** — description with mitigation", "**Risk 3** — description with mitigation"]
}

Important: Return ONLY the JSON object. Do not wrap it in markdown code blocks. Text field VALUES should use markdown formatting for structure.`;
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

export function buildSignalCardPrompt(
  problem: ScoredProblem,
  evidenceMetadata: EvidenceMetadata
): string {
  const sourcesList = problem.sources.join(', ');

  return `Describe an early signal of developer pain detected from community forums.

## Signal Data

**Problem Statement:** ${problem.problemStatement}

**Evidence:**
- ${evidenceMetadata.sourceCount} source(s) across ${evidenceMetadata.platformCount} platform(s)
- ${evidenceMetadata.totalEngagement} total engagement
- Evidence tier: ${evidenceMetadata.tier}

**Signal Strength:**
- Frequency: ${problem.frequency} mentions (${sourcesList})
- Community Validation: ${problem.scores.engagement.toFixed(1)}/10

**Representative Post:**
- Source: ${problem.representativePost.source}
- Title: ${problem.representativePost.title}
- URL: ${problem.representativePost.url}
- Score: ${problem.representativePost.score} upvotes, ${problem.representativePost.commentCount} comments

## Output Requirements

Generate a JSON object with these exact fields:

{
  "name": "Product name (1-2 words)",
  "tagline": "One-line description (under 10 words)",
  "problemStatement": "What pain point was detected. Lead with the evidence.",
  "targetAudience": "Who might experience this problem",
  "proposedSolution": "A possible approach — framed as an idea to explore, not a proven solution",
  "keyFeatures": ["2-3 possible features, each prefixed with 'Possible:' to signal these are ideas, not validated"]
}

Important: Return ONLY the JSON object. Do not wrap it in markdown code blocks.`;
}

/**
 * Parse GPT response as JSON.
 * Delegates to the shared extractJson utility.
 */
export function parseJsonResponse<T>(response: string): T | null {
  return extractJson<T>(response);
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
    evidenceMetadata?: EvidenceMetadata;
  }>
): string {
  const signalCardSchema = `{
    "id": "problem_id",
    "name": "Product name (1-2 words)",
    "tagline": "One-line description (under 10 words)",
    "problemStatement": "What pain point was detected. Lead with the evidence.",
    "targetAudience": "Who might experience this problem",
    "proposedSolution": "A possible approach — framed as an idea to explore, not a proven solution",
    "keyFeatures": ["2-3 possible features, each prefixed with 'Possible:'"]
  }`;

  const problemsData = problems.map((p, index) => {
    const competitorList = p.gaps.existingSolutions
      .slice(0, 5)
      .map(c => `${c.name}: ${c.description}`)
      .join('; ');

    const gapsList = p.gaps.gaps.slice(0, 5).join('; ');

    const isWeak = p.evidenceMetadata?.tier === 'weak';
    const isModerate = p.evidenceMetadata?.tier === 'moderate';
    const isStrong = p.evidenceMetadata?.tier === 'strong';

    let evidenceLine = '';
    if (isWeak && p.evidenceMetadata) {
      evidenceLine = `\n**SIGNAL CARD — reduced output** (${p.evidenceMetadata.sourceCount} sources, ${p.evidenceMetadata.totalEngagement} engagement). Use signal card schema below.`;
    } else if (isModerate && p.evidenceMetadata) {
      evidenceLine = `\n**Evidence: moderate** (${p.evidenceMetadata.sourceCount} sources, ${p.evidenceMetadata.totalEngagement} engagement). Be measured in projections. Flag assumptions with 'ASSUMPTION:' prefix.`;
    } else if (isStrong && p.evidenceMetadata) {
      evidenceLine = `\n**Evidence: strong** (${p.evidenceMetadata.sourceCount} sources across ${p.evidenceMetadata.platformCount} platforms, ${p.evidenceMetadata.totalEngagement} engagement). Ground analysis in the specific data provided.`;
    }

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
**Suggested Stack:** ${p.stackRecommendation.stack.join(', ')}${evidenceLine}`;
  }).join('\n');

  const hasWeakProblems = problems.some(p => p.evidenceMetadata?.tier === 'weak');

  const signalCardNote = hasWeakProblems
    ? `\n\nFor problems marked **SIGNAL CARD — reduced output**, use this reduced schema instead:\n${signalCardSchema}`
    : '';

  return `Generate business briefs for the following ${problems.length} startup opportunities.

${problemsData}

## Output Requirements

Return a JSON array with ${problems.length} briefs, one for each problem above. Each full brief should have these fields:

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
    "proposedSolution": "Concrete solution with specific implementation approach. Name exact tools, APIs, or data sources. Detailed enough for an engineer to start building.",
    "keyFeatures": ["5 features described as user stories with acceptance criteria. Each should reference specific technical implementation."],
    "mvpScope": "Numbered list of exact screens/endpoints to build for a launchable v1. Include data model (key entities and relationships) and the 3-5 API routes needed.",
    "architecture": "System design: frontend framework, backend framework, database with key tables, external APIs/services to integrate, deployment target. Be specific enough that an agent could generate a project scaffold.",
    "pricing": "Specific dollar amounts for each tier with feature gates. Example: 'Free: 5 projects, Pro $12/mo: unlimited + analytics, Team $29/seat/mo: SSO + audit log'.",
    "revenueProjection": "Month 1/6/12/24 revenue projections with subscriber/customer count assumptions. Show the math.",
    "monetizationPath": "Revenue model",
    "launchStrategy": "Week-by-week launch playbook: pre-launch (landing page, waitlist), launch day (specific communities + post templates), post-launch (growth loops).",
    "channels": ["Channel 1", "Channel 2"],
    "firstCustomers": "Step-by-step playbook: where to find them (specific subreddits/communities/companies), what to say (outreach template), how to convert (offer structure).",
    "risks": ["Risk 1", "Risk 2", "Risk 3"]
  }
]${signalCardNote}

CRITICAL: Every field in every brief must contain specific, substantive content. Do not use placeholder text like "TBD", "To be determined", or "Research required". Base all content on the problem data provided above.

Format all text field VALUES using markdown: use **bold** for key terms, bullet points for lists, ### headers for subsections, and tables where appropriate. This makes briefs scannable and actionable.

Important: Return ONLY the JSON array with ${problems.length} objects. Do not wrap it in markdown code blocks. Text field VALUES should use markdown formatting for structure.`;
}
