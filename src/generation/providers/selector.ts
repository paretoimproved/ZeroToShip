import { config as envConfig } from '../../config/env';
import { GraphGenerationProvider } from './graph-provider';
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

  return {
    requestedMode,
    effectiveMode: 'graph',
    provider: new GraphGenerationProvider(),
  };
}
