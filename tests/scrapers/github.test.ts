import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubScraper, DEFAULT_GITHUB_QUERIES, scrapeGitHub } from '../../src/scrapers/github';
import { detectSignals, PAIN_POINT_SIGNALS } from '../../src/scrapers/signals';

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
    it('should have 8 queries', () => {
      expect(DEFAULT_GITHUB_QUERIES).toHaveLength(8);
    });

    it('should have a query for pain points', () => {
      const query = DEFAULT_GITHUB_QUERIES.find(q =>
        q.query.includes('pain point')
      );
      expect(query).toBeDefined();
    });

    it('should have a query for self-hosted alternatives', () => {
      const query = DEFAULT_GITHUB_QUERIES.find(q =>
        q.query.includes('self-hosted') && q.query.includes('alternative')
      );
      expect(query).toBeDefined();
    });

    it('should have a query for willingness to pay', () => {
      const query = DEFAULT_GITHUB_QUERIES.find(q =>
        q.query.includes('would pay for')
      );
      expect(query).toBeDefined();
    });

    it('should have a query for wishful thinking', () => {
      const query = DEFAULT_GITHUB_QUERIES.find(q =>
        q.query.includes('I wish there was')
      );
      expect(query).toBeDefined();
    });

    it('should have a query for market gaps', () => {
      const query = DEFAULT_GITHUB_QUERIES.find(q =>
        q.query.includes('no good tool')
      );
      expect(query).toBeDefined();
    });

    it('should all target open issues with body search', () => {
      for (const q of DEFAULT_GITHUB_QUERIES) {
        expect(q.query).toContain('in:body');
        expect(q.query).toContain('is:issue');
        expect(q.query).toContain('is:open');
      }
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
