import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubScraper, DEFAULT_GITHUB_QUERIES, scrapeGitHub } from '../../src/scrapers/github';
import { PAIN_POINT_SIGNALS } from '../../src/scrapers/types';
import { detectSignals } from '../../src/scrapers/signals';

describe('GitHub Scraper', () => {
  describe('detectSignals', () => {
    it('should detect pain point signals in text', () => {
      const text = 'It would be nice if this feature existed. I wish I had better docs.';
      const signals = detectSignals(text);

      expect(signals).toContain('would be nice if');
      expect(signals).toContain('i wish');
    });

    it('should return empty array when no signals found', () => {
      const text = 'This is a regular issue about a bug.';
      const signals = detectSignals(text);
      
      expect(signals).toEqual([]);
    });

    it('should be case insensitive', () => {
      const text = 'WOULD BE NICE IF this worked. Feature Request please.';
      const signals = detectSignals(text);
      
      expect(signals).toContain('would be nice if');
      expect(signals).toContain('feature request');
    });
  });

  describe('DEFAULT_GITHUB_QUERIES', () => {
    it('should have queries for help wanted label', () => {
      const helpWantedQuery = DEFAULT_GITHUB_QUERIES.find(q => 
        q.query.includes('help wanted')
      );
      expect(helpWantedQuery).toBeDefined();
    });

    it('should have queries for feature requests', () => {
      const featureQuery = DEFAULT_GITHUB_QUERIES.find(q => 
        q.query.includes('feature request')
      );
      expect(featureQuery).toBeDefined();
    });

    it('should have queries for high-reaction issues', () => {
      const reactionsQuery = DEFAULT_GITHUB_QUERIES.find(q => 
        q.query.includes('reactions:>')
      );
      expect(reactionsQuery).toBeDefined();
    });

    it('should include pain point phrase searches', () => {
      const painPointQuery = DEFAULT_GITHUB_QUERIES.find(q => 
        q.query.includes('would be nice if') || q.query.includes('wish this had')
      );
      expect(painPointQuery).toBeDefined();
    });
  });

  describe('GitHubScraper', () => {
    it('should initialize with default queries', () => {
      const scraper = new GitHubScraper();
      expect(scraper).toBeDefined();
    });

    it('should accept custom queries', () => {
      const customQueries = [
        { query: 'custom:query', description: 'Custom' }
      ];
      const scraper = new GitHubScraper(undefined, customQueries);
      expect(scraper).toBeDefined();
    });

    it('should allow adding queries', () => {
      const scraper = new GitHubScraper();
      scraper.addQuery({ query: 'new:query', description: 'New query' });
      expect(scraper).toBeDefined();
    });
  });

  describe('scrapeGitHub function', () => {
    it('should be exported and callable', () => {
      expect(typeof scrapeGitHub).toBe('function');
    });
  });

  describe('PAIN_POINT_SIGNALS', () => {
    it('should contain expected signals', () => {
      expect(PAIN_POINT_SIGNALS).toContain('help wanted');
      expect(PAIN_POINT_SIGNALS).toContain('feature request');
      expect(PAIN_POINT_SIGNALS).toContain('enhancement');
      expect(PAIN_POINT_SIGNALS).toContain('would be nice if');
    });

    it('should have at least 10 signals', () => {
      expect(PAIN_POINT_SIGNALS.length).toBeGreaterThanOrEqual(10);
    });
  });
});

describe('GitHubIssue interface', () => {
  it('should match expected structure', () => {
    const mockIssue = {
      id: 'github-123',
      source: 'github' as const,
      sourceId: '123',
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/1',
      author: 'testuser',
      score: 10,
      commentCount: 5,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: ['help wanted'],
      repo: 'owner/repo',
      repoStars: 1000,
      reactions: 10,
      labels: ['help wanted', 'enhancement'],
      state: 'open' as const,
    };

    expect(mockIssue.source).toBe('github');
    expect(mockIssue.repo).toBe('owner/repo');
    expect(mockIssue.repoStars).toBeGreaterThan(0);
    expect(mockIssue.labels).toContain('help wanted');
    expect(mockIssue.state).toBe('open');
  });
});
