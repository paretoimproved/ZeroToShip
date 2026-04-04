/**
 * Tests for CLI argument parsing, specifically the --generation-mode flag.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/scheduler/cli';

describe('parseArgs', () => {
  it('should default command to help', () => {
    const options = parseArgs([]);
    expect(options.command).toBe('help');
  });

  it('should parse run command', () => {
    const options = parseArgs(['run']);
    expect(options.command).toBe('run');
  });

  it('should parse schedule command', () => {
    const options = parseArgs(['schedule']);
    expect(options.command).toBe('schedule');
  });

  it('should parse --dry-run flag', () => {
    const options = parseArgs(['run', '--dry-run']);
    expect(options.dryRun).toBe(true);
  });

  it('should parse --hours option', () => {
    const options = parseArgs(['run', '--hours', '48']);
    expect(options.hoursBack).toBe(48);
  });

  it('should parse --max-briefs option', () => {
    const options = parseArgs(['run', '--max-briefs', '5']);
    expect(options.maxBriefs).toBe(5);
  });

  it('should parse --verbose flag', () => {
    const options = parseArgs(['run', '--verbose']);
    expect(options.verbose).toBe(true);
  });

  it('should parse -v flag', () => {
    const options = parseArgs(['run', '-v']);
    expect(options.verbose).toBe(true);
  });

  describe('--generation-mode flag', () => {
    it('should parse --generation-mode graph', () => {
      const options = parseArgs(['run', '--generation-mode', 'graph']);
      expect(options.generationMode).toBe('graph');
    });

    it('should parse --generation-mode legacy', () => {
      const options = parseArgs(['run', '--generation-mode', 'legacy']);
      expect(options.generationMode).toBe('legacy');
    });

    it('should leave generationMode undefined when flag is not provided', () => {
      const options = parseArgs(['run', '--dry-run']);
      expect(options.generationMode).toBeUndefined();
    });

    it('should ignore invalid generation mode values', () => {
      const options = parseArgs(['run', '--generation-mode', 'invalid']);
      expect(options.generationMode).toBeUndefined();
    });

    it('should work with run command and other flags', () => {
      const options = parseArgs([
        'run',
        '--dry-run',
        '--generation-mode',
        'graph',
        '--hours',
        '48',
        '--max-briefs',
        '5',
      ]);
      expect(options.command).toBe('run');
      expect(options.dryRun).toBe(true);
      expect(options.generationMode).toBe('graph');
      expect(options.hoursBack).toBe(48);
      expect(options.maxBriefs).toBe(5);
    });

    it('should work with schedule command', () => {
      const options = parseArgs(['schedule', '--generation-mode', 'graph']);
      expect(options.command).toBe('schedule');
      expect(options.generationMode).toBe('graph');
    });
  });
});
