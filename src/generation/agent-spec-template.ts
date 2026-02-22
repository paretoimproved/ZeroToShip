/**
 * Agent-Ready Spec Generation Prompt Template
 *
 * Transforms an existing IdeaBrief into a developer-focused,
 * agent-ready specification that can be handed directly to an
 * AI coding agent like Claude Code.
 */

import type { IdeaBrief } from '@zerotoship/shared';

/**
 * The structured agent spec output
 */
export interface AgentSpec {
  projectName: string;
  problem: string;
  evidence: {
    sourceCount: number;
    platforms: string[];
    signalScore: number;
    trend: 'rising' | 'stable' | 'falling';
  };
  userStories: Array<{
    persona: string;
    capability: string;
    outcome: string;
    acceptanceCriteria: string[];
  }>;
  technicalArchitecture: {
    stack: string[];
    stackRationale: string;
    databaseSchema: Array<{
      table: string;
      keyColumns: string[];
      relations: string;
    }>;
    apiEndpoints: Array<{
      method: string;
      route: string;
      purpose: string;
    }>;
    keyComponents: string; // File tree as string
  };
  mvpScope: {
    mustHave: string[];
    skipForNow: string[];
  };
  agentInstructions: string; // CLAUDE.md content
  sources: Array<{
    title: string;
    url: string;
    platform: string;
    score: number;
    comments: number;
  }>;
}

/**
 * System prompt for agent-spec generation
 */
export const AGENT_SPEC_SYSTEM_PROMPT = `You are a senior technical architect who writes specifications that AI coding agents can immediately act on. Your specs are precise, opinionated, and complete enough to scaffold a working MVP.

You are given an analyzed business brief about a validated problem. Your job is to transform it into a developer-ready specification with:
- Clear user stories with testable acceptance criteria
- Concrete database schema with tables and relations
- Specific API endpoints with methods and routes
- A component/file architecture
- A 48-hour MVP scope with must-haves and skip-for-nows
- Agent instructions (CLAUDE.md) ready to paste into a project

Guidelines:
- Be ruthlessly specific: name exact tables, columns, routes, and file paths
- Choose a modern, practical stack (default to Next.js + PostgreSQL + Tailwind unless the problem demands otherwise)
- Design for a solo developer shipping in 48 hours, not a team of 10
- User stories should cover the core loop only — 5-8 stories max
- Database schema should be minimal but complete for the MVP
- API endpoints should be RESTful and cover CRUD for core entities
- The agent instructions should include project context, conventions, what to build first, and what to avoid
- CRITICAL: Return valid JSON matching the requested schema. Do not wrap in markdown code blocks.`;

/**
 * Build the prompt to generate an agent-ready spec from a brief
 */
export function buildAgentSpecPrompt(brief: IdeaBrief): string {
  const sourcesText = (brief.sources ?? [])
    .map(
      (s, i) =>
        `${i + 1}. [${s.platform}] "${s.title}" — ${s.score} points, ${s.commentCount} comments (${s.url})`
    )
    .join('\n');

  return `Transform the following business brief into an agent-ready technical specification.

## Business Brief

**Name:** ${brief.name}
**Tagline:** ${brief.tagline}
**Priority Score:** ${brief.priorityScore}/100
**Effort Estimate:** ${brief.effortEstimate}

### Problem
${brief.problemStatement}

### Target Audience
${brief.targetAudience || 'Not specified'}

### Market Size
${brief.marketSize || 'Not specified'}

### Existing Solutions
${brief.existingSolutions || 'None identified'}

### Market Gaps
${brief.gaps || 'None identified'}

### Proposed Solution
${brief.proposedSolution || 'Not specified'}

### Key Features
${(brief.keyFeatures ?? []).map((f, i) => `${i + 1}. ${f}`).join('\n') || 'Not specified'}

### MVP Scope
${brief.mvpScope || 'Not specified'}

### Technical Spec
- **Stack:** ${brief.technicalSpec?.stack?.join(', ') || 'Not specified'}
- **Architecture:** ${brief.technicalSpec?.architecture || 'Not specified'}

### Business Model
- **Pricing:** ${brief.businessModel?.pricing || 'Not specified'}
- **Monetization:** ${brief.businessModel?.monetizationPath || 'Not specified'}

### Sources
${sourcesText || 'No sources available'}

## Output Requirements

Generate a JSON object with these exact fields:

{
  "projectName": "kebab-case project name",
  "problem": "2-3 sentence problem statement backed by evidence",
  "evidence": {
    "sourceCount": <number of source posts>,
    "platforms": ["reddit", "hn", etc.],
    "signalScore": <priority score>,
    "trend": "rising" | "stable" | "falling"
  },
  "userStories": [
    {
      "persona": "who (e.g., 'a solo developer')",
      "capability": "what they want to do",
      "outcome": "why / the benefit",
      "acceptanceCriteria": ["testable criterion 1", "testable criterion 2"]
    }
  ],
  "technicalArchitecture": {
    "stack": ["Next.js 15", "PostgreSQL", "Tailwind CSS", etc.],
    "stackRationale": "1-sentence why this stack",
    "databaseSchema": [
      {
        "table": "users",
        "keyColumns": ["id", "email", "created_at"],
        "relations": "has_many: projects"
      }
    ],
    "apiEndpoints": [
      {
        "method": "POST",
        "route": "/api/auth/signup",
        "purpose": "Create account"
      }
    ],
    "keyComponents": "app/\\n  (auth)/login/page.tsx\\n  (dashboard)/page.tsx\\n  api/\\n    auth/route.ts"
  },
  "mvpScope": {
    "mustHave": ["Core feature 1", "Core feature 2"],
    "skipForNow": ["Nice-to-have 1", "Nice-to-have 2"]
  },
  "agentInstructions": "Full CLAUDE.md content as a string. Include project context, stack decisions, conventions, build order, and what to avoid.",
  "sources": [
    {
      "title": "Original post title",
      "url": "https://...",
      "platform": "reddit",
      "score": 234,
      "comments": 89
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, no markdown code blocks
- Include 5-8 user stories for the MVP
- Database schema should have 4-8 tables
- API endpoints should cover 8-15 routes
- The agentInstructions field should be a comprehensive CLAUDE.md (500+ words)
- Must-have items should be achievable in 48 hours by a solo developer with an AI agent`;
}
