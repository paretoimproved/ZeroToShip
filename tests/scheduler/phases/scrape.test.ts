/**
 * Integration tests for the Scrape Phase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runScrapePhase } from '../../../src/scheduler/phases/scrape';
import type { PipelineConfig } from '../../../src/scheduler/types';

// Mock all scrapers
vi.mock('../../../src/scrapers/reddit', () => ({
  scrapeReddit: vi.fn(),
  DEFAULT_SUBREDDITS: ['test'],
}));

vi.mock('../../../src/scrapers/hackernews', () => ({
  scrapeHackerNews: vi.fn(),
}));

vi.mock('../../../src/scrapers/twitter', () => ({
  twitterScraper: {
    scrapeAll: vi.fn(),
  },
}));

vi.mock('../../../src/scrapers/github', () => ({
  scrapeGitHub: vi.fn(),
}));

// Mock retry to skip delays
vi.mock('../../../src/scheduler/utils/retry', () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

function makeConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    hoursBack: 24,
    scrapers: { reddit: true, hn: true, twitter: true, github: true },
    clusteringThreshold: 0.85,
    minFrequencyForGap: 2,
    maxBriefs: 10,
    minPriorityScore: 0.5,
    dryRun: false,
    verbose: false,
    ...overrides,
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: `post_${Math.random().toString(36).slice(2, 8)}`,
    source: 'reddit' as const,
    sourceId: `src_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test post',
    body: 'Test body',
    url: 'https://example.com',
    author: 'testuser',
    score: 100,
    commentCount: 50,
    createdAt: new Date(),
    scrapedAt: new Date(),
    signals: ['wish there was'],
    ...overrides,
  };
}

describe('Scrape Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path', () => {
    it('should return successful result with posts from all scrapers', async () => {
      const { scrapeReddit } = await import('../../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../../src/scrapers/github');

      const redditPosts = [makePost({ source: 'reddit', sourceId: 'r1' })];
      const hnPosts = [makePost({ source: 'hn', sourceId: 'hn1' })];
      const tweets = [makePost({ source: 'twitter', sourceId: 'tw1' })];
      const ghPosts = [makePost({ source: 'github', sourceId: 'gh1' })];

      vi.mocked(scrapeReddit).mockResolvedValue(redditPosts);
      vi.mocked(scrapeHackerNews).mockResolvedValue(hnPosts);
      vi.mocked(twitterScraper.scrapeAll).mockResolvedValue({
        tweets, method: 'nitter', totalFound: 1, errors: [], duration: 0, queriesUsed: [],
      });
      vi.mocked(scrapeGitHub).mockResolvedValue(ghPosts);

      const result = await runScrapePhase('test-run-1', makeConfig());

      expect(result.success).toBe(true);
      expect(result.phase).toBe('scrape');
      expect(result.data).not.toBeNull();
      expect(result.data!.totalPosts).toBe(4);
      expect(result.data!.reddit.success).toBe(true);
      expect(result.data!.reddit.count).toBe(1);
      expect(result.data!.hn.success).toBe(true);
      expect(result.data!.twitter.success).toBe(true);
      expect(result.data!.github.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should only run enabled scrapers', async () => {
      const { scrapeReddit } = await import('../../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../../src/scrapers/github');

      vi.mocked(scrapeReddit).mockResolvedValue([makePost()]);

      const config = makeConfig({
        scrapers: { reddit: true, hn: false, twitter: false, github: false },
      });

      const result = await runScrapePhase('test-run-2', config);

      expect(result.success).toBe(true);
      expect(result.data!.totalPosts).toBe(1);
      expect(scrapeReddit).toHaveBeenCalled();
      expect(scrapeHackerNews).not.toHaveBeenCalled();
      expect(twitterScraper.scrapeAll).not.toHaveBeenCalled();
      expect(scrapeGitHub).not.toHaveBeenCalled();
    });

    it('should deduplicate posts with the same source and sourceId', async () => {
      const { scrapeReddit } = await import('../../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../../src/scrapers/hackernews');

      const duplicatePost = makePost({ source: 'reddit', sourceId: 'dup1' });
      vi.mocked(scrapeReddit).mockResolvedValue([duplicatePost]);
      // Same source + sourceId from HN mock (simulating a cross-source duplicate)
      vi.mocked(scrapeHackerNews).mockResolvedValue([
        makePost({ source: 'reddit', sourceId: 'dup1' }),
      ]);

      const config = makeConfig({
        scrapers: { reddit: true, hn: true, twitter: false, github: false },
      });

      const result = await runScrapePhase('test-run-dedup', config);

      expect(result.success).toBe(true);
      expect(result.data!.totalPosts).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should continue when individual scrapers fail (degraded mode)', async () => {
      const { scrapeReddit } = await import('../../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../../src/scrapers/github');

      // Only Reddit succeeds
      vi.mocked(scrapeReddit).mockResolvedValue([makePost()]);
      vi.mocked(scrapeHackerNews).mockRejectedValue(new Error('HN down'));
      vi.mocked(twitterScraper.scrapeAll).mockRejectedValue(new Error('Twitter down'));
      vi.mocked(scrapeGitHub).mockRejectedValue(new Error('GitHub down'));

      const result = await runScrapePhase('test-run-partial', makeConfig());

      expect(result.success).toBe(true);
      expect(result.data!.totalPosts).toBe(1);
      expect(result.data!.reddit.success).toBe(true);
      expect(result.data!.hn.success).toBe(false);
      expect(result.data!.hn.error).toBeDefined();
      expect(result.data!.twitter.success).toBe(false);
      expect(result.data!.github.success).toBe(false);
    });

    it('should return failure when all scrapers fail', async () => {
      const { scrapeReddit } = await import('../../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../../src/scrapers/github');

      vi.mocked(scrapeReddit).mockRejectedValue(new Error('Reddit down'));
      vi.mocked(scrapeHackerNews).mockRejectedValue(new Error('HN down'));
      vi.mocked(twitterScraper.scrapeAll).mockRejectedValue(new Error('Twitter down'));
      vi.mocked(scrapeGitHub).mockRejectedValue(new Error('GitHub down'));

      const result = await runScrapePhase('test-run-all-fail', makeConfig());

      expect(result.success).toBe(false);
      expect(result.data!.totalPosts).toBe(0);
      expect(result.severity).toBe('fatal');
      expect(result.error).toBe('No posts scraped from any source');
    });

    it('should return failure when no scrapers are enabled', async () => {
      const config = makeConfig({
        scrapers: { reddit: false, hn: false, twitter: false, github: false },
      });

      const result = await runScrapePhase('test-run-none', config);

      expect(result.success).toBe(false);
      expect(result.data!.totalPosts).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle scrapers returning empty arrays', async () => {
      const { scrapeReddit } = await import('../../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../../src/scrapers/github');

      vi.mocked(scrapeReddit).mockResolvedValue([]);
      vi.mocked(scrapeHackerNews).mockResolvedValue([]);
      vi.mocked(twitterScraper.scrapeAll).mockResolvedValue({
        tweets: [], method: 'nitter', totalFound: 0, errors: [], duration: 0, queriesUsed: [],
      });
      vi.mocked(scrapeGitHub).mockResolvedValue([]);

      const result = await runScrapePhase('test-run-empty', makeConfig());

      // Scrapers succeeded but returned no posts
      expect(result.success).toBe(false);
      expect(result.data!.totalPosts).toBe(0);
      expect(result.data!.reddit.success).toBe(true);
      expect(result.data!.reddit.count).toBe(0);
    });

    it('should pass hoursBack config to scrapers', async () => {
      const { scrapeReddit } = await import('../../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../../src/scrapers/hackernews');

      vi.mocked(scrapeReddit).mockResolvedValue([makePost()]);
      vi.mocked(scrapeHackerNews).mockResolvedValue([]);

      const config = makeConfig({
        hoursBack: 48,
        scrapers: { reddit: true, hn: true, twitter: false, github: false },
      });

      await runScrapePhase('test-run-hours', config);

      expect(scrapeReddit).toHaveBeenCalledWith(expect.any(Array), 48);
      expect(scrapeHackerNews).toHaveBeenCalledWith(undefined, 48);
    });

    it('should enforce minimum 2160 hours for GitHub scraper', async () => {
      const { scrapeGitHub } = await import('../../../src/scrapers/github');

      vi.mocked(scrapeGitHub).mockResolvedValue([makePost({ source: 'github' })]);

      const config = makeConfig({
        hoursBack: 24,
        scrapers: { reddit: false, hn: false, twitter: false, github: true },
      });

      await runScrapePhase('test-run-gh-min', config);

      expect(scrapeGitHub).toHaveBeenCalledWith(undefined, 2160);
    });
  });
});
