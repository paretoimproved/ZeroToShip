/**
 * Agent Spec Generator
 *
 * Calls the Anthropic API to generate an agent-ready spec from a brief.
 */

import { callAnthropicApi } from '../lib/anthropic';
import { AGENT_SPEC_SYSTEM_PROMPT, buildAgentSpecPrompt } from './agent-spec-template';
import type { AgentSpec } from './agent-spec-template';
import type { IdeaBrief } from '@zerotoship/shared';
import { extractJson } from '../lib/json-parser';
import { config } from '../config/env';
import { CLAUDE_MODELS } from '../config/models';

/**
 * Generate an agent-ready spec from a brief using Claude
 */
export async function callSpecGeneration(brief: IdeaBrief): Promise<AgentSpec> {
  const prompt = buildAgentSpecPrompt(brief);

  const result = await callAnthropicApi({
    apiKey: config.ANTHROPIC_API_KEY,
    model: CLAUDE_MODELS.SONNET,
    system: AGENT_SPEC_SYSTEM_PROMPT,
    prompt,
    maxTokens: 8192,
    module: 'spec-generation',
  });

  const parsed = extractJson<AgentSpec>(result.text);
  if (!parsed) {
    throw new Error('Failed to parse agent spec from AI response');
  }

  return parsed;
}
