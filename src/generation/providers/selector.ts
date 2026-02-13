import { config as envConfig } from '../../config/env';
import logger from '../../lib/logger';
import { LegacyGenerationProvider } from './legacy-provider';
import type { GenerationProviderMode, SelectedGenerationProvider } from './types';

export function resolveGenerationMode(value?: string | null): GenerationProviderMode {
  return value === 'graph' ? 'graph' : 'legacy';
}

export function getConfiguredGenerationMode(): GenerationProviderMode {
  return resolveGenerationMode(envConfig.GENERATION_MODE);
}

export function selectGenerationProvider(
  requestedMode: GenerationProviderMode = getConfiguredGenerationMode(),
): SelectedGenerationProvider {
  if (requestedMode === 'legacy') {
    return {
      requestedMode,
      effectiveMode: 'legacy',
      provider: new LegacyGenerationProvider(),
    };
  }

  // Phase 1 seam: graph mode is selectable, but not implemented yet.
  logger.warn(
    { requestedMode },
    'Graph generation mode requested before graph provider implementation; falling back to legacy mode'
  );

  return {
    requestedMode,
    effectiveMode: 'legacy',
    provider: new LegacyGenerationProvider(),
  };
}
