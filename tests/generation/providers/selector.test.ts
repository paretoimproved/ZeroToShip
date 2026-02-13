import { afterEach, describe, expect, it } from 'vitest';
import { _resetConfigForTesting } from '../../../src/config/env';
import {
  getConfiguredGenerationMode,
  resolveGenerationMode,
  selectGenerationProvider,
} from '../../../src/generation/providers';
import { LegacyGenerationProvider } from '../../../src/generation/providers/legacy-provider';

describe('generation provider selector', () => {
  afterEach(() => {
    delete process.env.GENERATION_MODE;
    _resetConfigForTesting();
  });

  it('resolves legacy mode by default', () => {
    expect(resolveGenerationMode(undefined)).toBe('legacy');
    expect(resolveGenerationMode(null)).toBe('legacy');
    expect(resolveGenerationMode('unexpected')).toBe('legacy');
  });

  it('resolves graph mode when explicitly requested', () => {
    expect(resolveGenerationMode('graph')).toBe('graph');
  });

  it('reads configured mode from environment', () => {
    process.env.GENERATION_MODE = 'graph';
    _resetConfigForTesting();

    expect(getConfiguredGenerationMode()).toBe('graph');
  });

  it('returns legacy provider for legacy mode', () => {
    const selection = selectGenerationProvider('legacy');

    expect(selection.requestedMode).toBe('legacy');
    expect(selection.effectiveMode).toBe('legacy');
    expect(selection.provider).toBeInstanceOf(LegacyGenerationProvider);
  });

  it('falls back to legacy provider when graph mode is requested', () => {
    const selection = selectGenerationProvider('graph');

    expect(selection.requestedMode).toBe('graph');
    expect(selection.effectiveMode).toBe('legacy');
    expect(selection.provider).toBeInstanceOf(LegacyGenerationProvider);
  });
});
