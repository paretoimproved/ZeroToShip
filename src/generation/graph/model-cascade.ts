import { CLAUDE_MODELS } from '../../config/models';

export function buildGraphModelCascade(targetModel?: string): string[] {
  const normalizedTarget = targetModel?.trim();

  if (!normalizedTarget) {
    return [CLAUDE_MODELS.HAIKU, CLAUDE_MODELS.SONNET];
  }

  if (normalizedTarget === CLAUDE_MODELS.HAIKU) {
    return [CLAUDE_MODELS.HAIKU];
  }

  if (normalizedTarget === CLAUDE_MODELS.SONNET) {
    return [CLAUDE_MODELS.HAIKU, CLAUDE_MODELS.SONNET];
  }

  if (normalizedTarget === CLAUDE_MODELS.OPUS) {
    return [CLAUDE_MODELS.HAIKU, CLAUDE_MODELS.SONNET, CLAUDE_MODELS.OPUS];
  }

  return [normalizedTarget];
}

export function getAttemptModel(modelCascade: string[], attempt: number): string | undefined {
  if (modelCascade.length === 0) {
    return undefined;
  }

  const index = Math.min(Math.max(attempt - 1, 0), modelCascade.length - 1);
  return modelCascade[index];
}
