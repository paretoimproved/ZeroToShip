/**
 * Tests for non-technical content filter
 */

import { describe, it, expect } from 'vitest';
import {
  isNonTechnicalContent,
  detectNonTechnicalSignals,
  NON_TECHNICAL_PATTERNS,
} from '../../src/scrapers/content-filter';

describe('Content Filter', () => {
  describe('NON_TECHNICAL_PATTERNS', () => {
    it('should have all expected categories', () => {
      expect(NON_TECHNICAL_PATTERNS).toHaveProperty('career');
      expect(NON_TECHNICAL_PATTERNS).toHaveProperty('compensation');
      expect(NON_TECHNICAL_PATTERNS).toHaveProperty('workplace');
      expect(NON_TECHNICAL_PATTERNS).toHaveProperty('personal');
      expect(NON_TECHNICAL_PATTERNS).toHaveProperty('pessimism');
    });

    it('should have non-empty arrays for all categories', () => {
      for (const [category, patterns] of Object.entries(NON_TECHNICAL_PATTERNS)) {
        expect(patterns.length, `${category} should have patterns`).toBeGreaterThan(0);
      }
    });
  });

  describe('isNonTechnicalContent', () => {
    // ============================================
    // Should FILTER (returns true) — non-technical
    // ============================================

    it('should filter career/job search content', () => {
      expect(isNonTechnicalContent(
        'Just got laid off, feeling lost about career direction',
        ''
      )).toBe(true);
    });

    it('should filter job market anxiety', () => {
      expect(isNonTechnicalContent(
        'Is the job market really that bad for juniors?',
        ''
      )).toBe(true);
    });

    it('should filter salary negotiation', () => {
      expect(isNonTechnicalContent(
        'Salary negotiation tips for senior engineers',
        ''
      )).toBe(true);
    });

    it('should filter toxic workplace content', () => {
      expect(isNonTechnicalContent(
        'Toxic workplace - should I quit without another offer?',
        ''
      )).toBe(true);
    });

    it('should filter imposter syndrome content', () => {
      expect(isNonTechnicalContent(
        'Imposter syndrome is killing me',
        ''
      )).toBe(true);
    });

    it('should filter industry doom content', () => {
      expect(isNonTechnicalContent(
        'AI will replace all developers in 5 years',
        'The market is oversaturated and programming is dead'
      )).toBe(true);
    });

    it('should filter burnout content', () => {
      expect(isNonTechnicalContent(
        'Completely burned out after 2 years at FAANG',
        ''
      )).toBe(true);
    });

    it('should filter resume/interview content', () => {
      expect(isNonTechnicalContent(
        'Resume tips for getting past ATS systems',
        ''
      )).toBe(true);
    });

    it('should filter career change content', () => {
      expect(isNonTechnicalContent(
        'Thinking about a career change from dev to PM',
        ''
      )).toBe(true);
    });

    it('should filter leetcode/interview prep', () => {
      expect(isNonTechnicalContent(
        'Best leetcode strategy for FAANG interviews',
        ''
      )).toBe(true);
    });

    it('should filter compensation package discussions', () => {
      expect(isNonTechnicalContent(
        'How to evaluate a compensation package with stock options vest schedule',
        ''
      )).toBe(true);
    });

    it('should filter quiet quitting content', () => {
      expect(isNonTechnicalContent(
        'Is quiet quitting really the way to go?',
        ''
      )).toBe(true);
    });

    it('should filter return to office discussions', () => {
      expect(isNonTechnicalContent(
        'Our company just announced an rto mandate',
        ''
      )).toBe(true);
    });

    it('should filter mass layoffs content', () => {
      expect(isNonTechnicalContent(
        'More mass layoffs announced today',
        ''
      )).toBe(true);
    });

    it('should detect patterns in body text too', () => {
      expect(isNonTechnicalContent(
        'Advice needed',
        'I have been thinking of quitting my job because my manager is terrible'
      )).toBe(true);
    });

    // ============================================
    // Should NOT filter (returns false) — technical
    // ============================================

    it('should not filter Kubernetes networking problems', () => {
      expect(isNonTechnicalContent(
        'Frustrated with Kubernetes pod networking',
        'CNI plugin keeps dropping connections between pods'
      )).toBe(false);
    });

    it('should not filter tool requests', () => {
      expect(isNonTechnicalContent(
        "Why isn't there a good tool for database migrations?",
        ''
      )).toBe(false);
    });

    it('should not filter Docker production issues', () => {
      expect(isNonTechnicalContent(
        'Struggling with Docker compose in production',
        'Containers keep restarting with OOM errors'
      )).toBe(false);
    });

    it('should not filter monitoring requests', () => {
      expect(isNonTechnicalContent(
        'I wish there was a better way to monitor API latency',
        ''
      )).toBe(false);
    });

    it('should not filter deployment pipeline problems', () => {
      expect(isNonTechnicalContent(
        'The deployment pipeline keeps breaking',
        'GitHub Actions fails on every other push'
      )).toBe(false);
    });

    it('should not filter terraform state management', () => {
      expect(isNonTechnicalContent(
        'Need a tool for managing terraform state across teams',
        ''
      )).toBe(false);
    });

    it('should not filter API design discussions', () => {
      expect(isNonTechnicalContent(
        'REST vs GraphQL for a new microservice',
        'We need to decide on the API design for our new service'
      )).toBe(false);
    });

    it('should not filter build tool complaints', () => {
      expect(isNonTechnicalContent(
        'Webpack build times are killing our CI',
        'Takes 15 minutes for a full build'
      )).toBe(false);
    });

    it('should not filter database performance issues', () => {
      expect(isNonTechnicalContent(
        'PostgreSQL query performance degrades with large tables',
        'Our main table has 500M rows and joins are painfully slow'
      )).toBe(false);
    });

    // ============================================
    // Edge cases
    // ============================================

    it('should filter mixed content where career context dominates', () => {
      // "burned out from on-call" contains "burned out" which is a personal pattern
      expect(isNonTechnicalContent(
        "I'm burned out from on-call, wish there was better alerting",
        ''
      )).toBe(true);
    });

    it('should not filter "job scheduler" (technical use of "job")', () => {
      // "job scheduler" doesn't match any pattern — the patterns use
      // multi-word phrases like "job search", "job market", etc.
      expect(isNonTechnicalContent(
        'Job scheduler keeps crashing',
        'Our cron job scheduler OOMs every few hours'
      )).toBe(false);
    });

    it('should not filter empty strings', () => {
      expect(isNonTechnicalContent('', '')).toBe(false);
    });

    it('should not filter whitespace-only strings', () => {
      expect(isNonTechnicalContent('   ', '   ')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isNonTechnicalContent(
        'SALARY NEGOTIATION for Senior Engineers',
        ''
      )).toBe(true);
    });

    it('should match patterns that span title and body', () => {
      // The word "toxic" in the title and "workplace" in the body combine
      // to form "toxic workplace" in the concatenated text
      expect(isNonTechnicalContent(
        'Working in a toxic',
        'workplace is draining'
      )).toBe(true);
    });
  });

  describe('detectNonTechnicalSignals', () => {
    it('should return all matched patterns', () => {
      const signals = detectNonTechnicalSignals(
        'Got laid off, now doing leetcode prep for coding interviews with salary negotiation tips'
      );

      expect(signals).toContain('laid off');
      expect(signals).toContain('leetcode');
      expect(signals).toContain('coding interview');
      expect(signals).toContain('salary negotiation');
    });

    it('should return empty array for technical content', () => {
      const signals = detectNonTechnicalSignals(
        'Kubernetes pod networking issue with CNI plugin'
      );

      expect(signals).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(detectNonTechnicalSignals('')).toEqual([]);
    });

    it('should detect workplace patterns', () => {
      const signals = detectNonTechnicalSignals(
        'My manager is micromanaging everything and the office politics are insane'
      );

      expect(signals).toContain('micromanag');
      expect(signals).toContain('office politics');
    });

    it('should detect pessimism patterns', () => {
      const signals = detectNonTechnicalSignals(
        'Tech is dead and ai replacing everyone is inevitable'
      );

      expect(signals).toContain('tech is dead');
      expect(signals).toContain('ai replacing');
    });
  });
});
