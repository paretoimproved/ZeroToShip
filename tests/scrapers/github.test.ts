import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubScraper, DEFAULT_GITHUB_QUERIES, scrapeGitHub } from '../../src/scrapers/github';
import { detectSignals, PAIN_POINT_SIGNALS } from '../../src/scrapers/signals';
import { ScraperError } from '../../src/lib/errors';

// Mock the github-api module
vi.mock('../../src/scrapers/github-api', () => {
  const MockGitHubAPI = vi.fn().mockImplementation(() => ({
    validateToken: vi.fn().mockResolvedValue(true),
    searchIssues: vi.fn().mockResolvedValue({
      items: [],
      totalCount: 0,
      rateLimitRemaining: 5000,
    }),
    getRepoInfo: vi.fn().mockResolvedValue({
      stars: 50,
      fullName: 'owner/repo',
      description: 'A test repo',
    }),
    getRateLimit: vi.fn().mockResolvedValue({
      remaining: 5000,
      limit: 5000,
      resetAt: new Date(),
    }),
  }));
  return { GitHubAPI: MockGitHubAPI, GitHubSearchIssueItem: {} };
});

// Mock logger to avoid noise in tests
vi.mock('../../src/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

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

  describe('GitHubScraper.scrape() token validation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should validate token before scraping', async () => {
      const { GitHubAPI } = await import('../../src/scrapers/github-api');
      const scraper = new GitHubScraper('test-token', [
        { query: 'test in:body is:issue is:open', description: 'Test' },
      ]);

      await scraper.scrape();

      // Access the mock instance created by the constructor
      const mockInstance = vi.mocked(GitHubAPI).mock.results[0].value;
      expect(mockInstance.validateToken).toHaveBeenCalled();
    });

    it('should throw ScraperError when token is invalid', async () => {
      const { GitHubAPI } = await import('../../src/scrapers/github-api');

      // Make validateToken return false for this test
      vi.mocked(GitHubAPI).mockImplementationOnce(() => ({
        validateToken: vi.fn().mockResolvedValue(false),
        searchIssues: vi.fn(),
        getRepoInfo: vi.fn(),
        getRateLimit: vi.fn(),
      }) as unknown as InstanceType<typeof GitHubAPI>);

      const scraper = new GitHubScraper('bad-token', [
        { query: 'test in:body is:issue is:open', description: 'Test' },
      ]);

      await expect(scraper.scrape()).rejects.toThrow(ScraperError);
      await expect(scraper.scrape()).rejects.toThrow(/GitHub token is invalid or expired/);
    });

    it('should proceed with scraping when token is valid', async () => {
      const { GitHubAPI } = await import('../../src/scrapers/github-api');

      const scraper = new GitHubScraper('good-token', [
        { query: 'test in:body is:issue is:open', description: 'Test' },
      ]);

      const result = await scraper.scrape();

      const mockInstance = vi.mocked(GitHubAPI).mock.results[0].value;
      expect(mockInstance.validateToken).toHaveBeenCalledTimes(1);
      expect(mockInstance.searchIssues).toHaveBeenCalled();
      expect(result.posts).toBeDefined();
    });
  });

  describe('GitHubScraper.scrape() star filtering', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should filter issues below minStars threshold', async () => {
      const { GitHubAPI } = await import('../../src/scrapers/github-api');

      const mockItem = {
        id: 1,
        number: 1,
        title: 'Test issue',
        body: 'I wish there was a better tool',
        htmlUrl: 'https://github.com/owner/repo/issues/1',
        state: 'open' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: 'testuser',
        labels: [],
        comments: 3,
        reactions: 5,
        repoFullName: 'owner/repo',
      };

      vi.mocked(GitHubAPI).mockImplementationOnce(() => ({
        validateToken: vi.fn().mockResolvedValue(true),
        searchIssues: vi.fn().mockResolvedValue({
          items: [mockItem],
          totalCount: 1,
          rateLimitRemaining: 5000,
        }),
        getRepoInfo: vi.fn().mockResolvedValue({
          stars: 5, // Below default minStars of 10
          fullName: 'owner/repo',
          description: 'A small repo',
        }),
        getRateLimit: vi.fn(),
      }) as unknown as InstanceType<typeof GitHubAPI>);

      const scraper = new GitHubScraper('token', [
        { query: 'test in:body is:issue is:open', description: 'Test' },
      ]);

      const result = await scraper.scrape();
      expect(result.posts).toHaveLength(0);
    });

    it('should include issues at or above minStars threshold', async () => {
      const { GitHubAPI } = await import('../../src/scrapers/github-api');

      const mockItem = {
        id: 2,
        number: 2,
        title: 'Popular issue',
        body: 'I wish there was a better tool',
        htmlUrl: 'https://github.com/popular/repo/issues/2',
        state: 'open' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: 'testuser',
        labels: [],
        comments: 10,
        reactions: 20,
        repoFullName: 'popular/repo',
      };

      vi.mocked(GitHubAPI).mockImplementationOnce(() => ({
        validateToken: vi.fn().mockResolvedValue(true),
        searchIssues: vi.fn().mockResolvedValue({
          items: [mockItem],
          totalCount: 1,
          rateLimitRemaining: 5000,
        }),
        getRepoInfo: vi.fn().mockResolvedValue({
          stars: 15, // Above default minStars of 10
          fullName: 'popular/repo',
          description: 'A popular repo',
        }),
        getRateLimit: vi.fn(),
      }) as unknown as InstanceType<typeof GitHubAPI>);

      const scraper = new GitHubScraper('token', [
        { query: 'test in:body is:issue is:open', description: 'Test' },
      ]);

      const result = await scraper.scrape();
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].repo).toBe('popular/repo');
    });
  });

  describe('GitHubAPI.validateToken()', () => {
    it('should return true when getRateLimit succeeds', async () => {
      // Unmock to test the real validateToken logic
      const { GitHubAPI } = await vi.importActual<typeof import('../../src/scrapers/github-api')>('../../src/scrapers/github-api');
      const api = new GitHubAPI('test-token');

      // Mock the underlying octokit call to succeed
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          resources: {
            search: { remaining: 30, limit: 30, reset: Math.floor(Date.now() / 1000) + 3600 },
          },
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (api as any).octokit = { rateLimit: { get: mockGet } };

      const result = await api.validateToken();
      expect(result).toBe(true);
    });

    it('should return false when getRateLimit throws', async () => {
      const { GitHubAPI } = await vi.importActual<typeof import('../../src/scrapers/github-api')>('../../src/scrapers/github-api');
      const api = new GitHubAPI('bad-token');

      // Mock the underlying octokit call to throw
      const mockGet = vi.fn().mockRejectedValue(new Error('Bad credentials'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (api as any).octokit = { rateLimit: { get: mockGet } };

      const result = await api.validateToken();
      expect(result).toBe(false);
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
