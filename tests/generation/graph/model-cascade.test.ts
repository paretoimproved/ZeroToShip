import { describe, expect, it } from 'vitest';
import { CLAUDE_MODELS } from '../../../src/config/models';
import { buildGraphModelCascade, getAttemptModel } from '../../../src/generation/graph/model-cascade';

describe('graph model cascade', () => {
  it('defaults to haiku then sonnet', () => {
    expect(buildGraphModelCascade()).toEqual([
      CLAUDE_MODELS.HAIKU,
      CLAUDE_MODELS.SONNET,
    ]);
  });

  it('maps opus target to three-step cascade', () => {
    expect(buildGraphModelCascade(CLAUDE_MODELS.OPUS)).toEqual([
      CLAUDE_MODELS.HAIKU,
      CLAUDE_MODELS.SONNET,
      CLAUDE_MODELS.OPUS,
    ]);
  });

  it('reuses last cascade model for attempts beyond cascade length', () => {
    const cascade = buildGraphModelCascade(CLAUDE_MODELS.SONNET);

    expect(getAttemptModel(cascade, 1)).toBe(CLAUDE_MODELS.HAIKU);
    expect(getAttemptModel(cascade, 2)).toBe(CLAUDE_MODELS.SONNET);
    expect(getAttemptModel(cascade, 3)).toBe(CLAUDE_MODELS.SONNET);
  });
});
