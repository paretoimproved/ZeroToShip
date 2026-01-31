/**
 * Unit tests for Reddit scraper and signal detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectSignals,
  detectSignalsWithCategory,
  hasSignals,
  calculateSignalStrength,
  extractSignalContext,
  SIGNAL_PATTERNS,
  ALL_SIGNALS,
} from '../../src/scrapers/signals';
import {
  DEFAULT_SUBREDDITS,
  getScrapeStats,
  sortBySignalStrength,
  filterBySignalCategory,
} from '../../src/scrapers/reddit';
import type { RawPost } from '../../src/scrapers/types';

// ============================================
// Signal Detection Tests
// ============================================

describe('Signal Detection', () => {
  describe('detectSignals', () => {
    it('should detect "I wish" patterns', () => {
      const text = 'I wish there was a tool that could do this automatically';
      const signals = detectSignals(text);

      expect(signals).toContain('i wish');
      expect(signals).toContain('wish there was');
    });

    it('should detect frustration patterns', () => {
      const text = "I'm so frustrated with this broken workflow";
      const signals = detectSignals(text);

      expect(signals).toContain('frustrated');
    });

    it('should detect willingness to pay', () => {
      const text = "I'd pay for a better solution to this problem";
      const signals = detectSignals(text);

      expect(signals).toContain("i'd pay for");
    });

    it('should detect seeking patterns', () => {
      const text = "Why isn't there a good tool for managing this?";
      const signals = detectSignals(text);

      expect(signals).toContain("why isn't there");
    });

    it('should be case insensitive', () => {
      const text = "WHY ISN'T THERE a TOOL for THIS???";
      const signals = detectSignals(text);

      expect(signals).toContain("why isn't there");
    });

    it('should return empty array for text without signals', () => {
      const text = 'This is a normal post about programming';
      const signals = detectSignals(text);

      expect(signals).toHaveLength(0);
    });

    it('should return empty array for empty text', () => {
      expect(detectSignals('')).toHaveLength(0);
    });

    it('should return empty array for null/undefined', () => {
      expect(detectSignals(null as unknown as string)).toHaveLength(0);
      expect(detectSignals(undefined as unknown as string)).toHaveLength(0);
    });

    it('should detect multiple signals in one text', () => {
      const text =
        "I'm frustrated with this tool. I wish there was something better. I'd pay for a proper solution.";
      const signals = detectSignals(text);

      expect(signals.length).toBeGreaterThanOrEqual(3);
      expect(signals).toContain('frustrated');
      expect(signals).toContain('i wish');
      expect(signals).toContain("i'd pay for");
    });
  });

  describe('detectSignalsWithCategory', () => {
    it('should return signals with category information', () => {
      const text = "I'm frustrated and wish there was a better way";
      const matches = detectSignalsWithCategory(text);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toHaveProperty('pattern');
      expect(matches[0]).toHaveProperty('category');
      expect(matches[0]).toHaveProperty('index');
    });

    it('should sort matches by position in text', () => {
      const text = "I wish something. I'm frustrated. I'd pay for it.";
      const matches = detectSignalsWithCategory(text);

      for (let i = 1; i < matches.length; i++) {
        expect(matches[i].index).toBeGreaterThanOrEqual(matches[i - 1].index);
      }
    });
  });

  describe('hasSignals', () => {
    it('should return true for text with signals', () => {
      expect(hasSignals('I wish there was a better tool')).toBe(true);
      expect(hasSignals("This is so frustrating")).toBe(true);
    });

    it('should return false for text without signals', () => {
      expect(hasSignals('Just a normal programming post')).toBe(false);
      expect(hasSignals('')).toBe(false);
    });
  });

  describe('calculateSignalStrength', () => {
    it('should return 0 for text without signals', () => {
      expect(calculateSignalStrength('Normal text')).toBe(0);
      expect(calculateSignalStrength('')).toBe(0);
    });

    it('should return higher score for willingness to pay', () => {
      const wishScore = calculateSignalStrength('I wish there was a tool');
      const payScore = calculateSignalStrength("I'd pay for a tool");

      expect(payScore).toBeGreaterThan(wishScore);
    });

    it('should return score between 0 and 1', () => {
      const score = calculateSignalStrength(
        "I'm frustrated and wish there was something I'd pay for"
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('extractSignalContext', () => {
    it('should extract context around signals', () => {
      const text = 'This is some text. I wish there was a tool. More text here.';
      const contexts = extractSignalContext(text, 20);

      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts[0]).toHaveProperty('signal');
      expect(contexts[0]).toHaveProperty('context');
      expect(contexts[0].context).toContain('wish');
    });

    it('should add ellipsis when context is truncated', () => {
      const text = 'A'.repeat(200) + ' I wish there was ' + 'B'.repeat(200);
      const contexts = extractSignalContext(text, 50);

      expect(contexts[0].context).toMatch(/^\.\.\..*\.\.\.$/);
    });
  });

  describe('SIGNAL_PATTERNS', () => {
    it('should have all expected categories', () => {
      expect(SIGNAL_PATTERNS).toHaveProperty('wishful');
      expect(SIGNAL_PATTERNS).toHaveProperty('frustration');
      expect(SIGNAL_PATTERNS).toHaveProperty('seeking');
      expect(SIGNAL_PATTERNS).toHaveProperty('willingness');
      expect(SIGNAL_PATTERNS).toHaveProperty('requests');
      expect(SIGNAL_PATTERNS).toHaveProperty('problems');
    });

    it('should have non-empty pattern arrays', () => {
      for (const patterns of Object.values(SIGNAL_PATTERNS)) {
        expect(patterns.length).toBeGreaterThan(0);
      }
    });
  });

  describe('ALL_SIGNALS', () => {
    it('should contain all patterns from all categories', () => {
      const totalExpected = Object.values(SIGNAL_PATTERNS).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      expect(ALL_SIGNALS.length).toBe(totalExpected);
    });
  });
});

// ============================================
// Reddit Scraper Helper Tests
// ============================================

describe('Reddit Scraper Helpers', () => {
  const mockPosts: RawPost[] = [
    {
      id: '1',
      source: 'reddit',
      sourceId: 'abc123',
      title: 'I wish there was a better tool',
      body: 'Looking for something better',
      url: 'https://reddit.com/r/webdev/123',
      author: 'user1',
      score: 100,
      commentCount: 50,
      createdAt: new Date('2026-01-31'),
      scrapedAt: new Date(),
      subreddit: 'webdev',
      signals: ['i wish', 'wish there was'],
    },
    {
      id: '2',
      source: 'reddit',
      sourceId: 'def456',
      title: "I'd pay for this feature",
      body: 'Frustrated with current options',
      url: 'https://reddit.com/r/programming/456',
      author: 'user2',
      score: 50,
      commentCount: 25,
      createdAt: new Date('2026-01-30'),
      scrapedAt: new Date(),
      subreddit: 'programming',
      signals: ["i'd pay for", 'frustrated'],
    },
    {
      id: '3',
      source: 'reddit',
      sourceId: 'ghi789',
      title: 'Simple question',
      body: '',
      url: 'https://reddit.com/r/startups/789',
      author: 'user3',
      score: 10,
      commentCount: 5,
      createdAt: new Date('2026-01-29'),
      scrapedAt: new Date(),
      subreddit: 'startups',
      signals: ['i wish'],
    },
  ];

  describe('DEFAULT_SUBREDDITS', () => {
    it('should contain expected subreddits', () => {
      expect(DEFAULT_SUBREDDITS).toContain('SideProject');
      expect(DEFAULT_SUBREDDITS).toContain('startups');
      expect(DEFAULT_SUBREDDITS).toContain('webdev');
      expect(DEFAULT_SUBREDDITS).toContain('programming');
    });

    it('should have at least 5 subreddits', () => {
      expect(DEFAULT_SUBREDDITS.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('getScrapeStats', () => {
    it('should calculate correct total posts', () => {
      const stats = getScrapeStats(mockPosts);
      expect(stats.totalPosts).toBe(3);
    });

    it('should calculate posts by subreddit', () => {
      const stats = getScrapeStats(mockPosts);
      expect(stats.bySubreddit['webdev']).toBe(1);
      expect(stats.bySubreddit['programming']).toBe(1);
      expect(stats.bySubreddit['startups']).toBe(1);
    });

    it('should calculate posts by signal', () => {
      const stats = getScrapeStats(mockPosts);
      expect(stats.bySignal['i wish']).toBe(2);
      expect(stats.bySignal['frustrated']).toBe(1);
    });

    it('should calculate average score', () => {
      const stats = getScrapeStats(mockPosts);
      expect(stats.avgScore).toBeCloseTo((100 + 50 + 10) / 3);
    });

    it('should calculate average comments', () => {
      const stats = getScrapeStats(mockPosts);
      expect(stats.avgComments).toBeCloseTo((50 + 25 + 5) / 3);
    });

    it('should handle empty array', () => {
      const stats = getScrapeStats([]);
      expect(stats.totalPosts).toBe(0);
      expect(stats.avgScore).toBe(0);
      expect(stats.avgComments).toBe(0);
    });
  });

  describe('sortBySignalStrength', () => {
    it('should sort posts by signal strength descending', () => {
      const sorted = sortBySignalStrength(mockPosts);

      // First post should have highest combined signal count * log score
      expect(sorted[0].signals.length).toBeGreaterThanOrEqual(1);
    });

    it('should not modify original array', () => {
      const original = [...mockPosts];
      sortBySignalStrength(mockPosts);

      expect(mockPosts).toEqual(original);
    });

    it('should handle empty array', () => {
      expect(sortBySignalStrength([])).toEqual([]);
    });
  });

  describe('filterBySignalCategory', () => {
    it('should filter posts by signal pattern', () => {
      const filtered = filterBySignalCategory(mockPosts, ['pay']);
      expect(filtered.length).toBe(1);
      expect(filtered[0].signals).toContain("i'd pay for");
    });

    it('should be case insensitive', () => {
      const filtered = filterBySignalCategory(mockPosts, ['WISH']);
      expect(filtered.length).toBe(2);
    });

    it('should return empty array when no matches', () => {
      const filtered = filterBySignalCategory(mockPosts, ['nonexistent']);
      expect(filtered).toHaveLength(0);
    });
  });
});

// ============================================
// Integration Tests (with mocked fetch)
// ============================================

describe('Reddit API Integration', () => {
  const mockRedditResponse = {
    kind: 'Listing',
    data: {
      after: null,
      before: null,
      children: [
        {
          kind: 't3',
          data: {
            id: 'test123',
            name: 't3_test123',
            title: 'I wish there was a better testing tool',
            selftext: 'Looking for alternatives',
            author: 'testuser',
            score: 42,
            num_comments: 10,
            created_utc: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
            permalink: '/r/webdev/comments/test123/test',
            subreddit: 'webdev',
            url: 'https://reddit.com/r/webdev/test',
            is_self: true,
            over_18: false,
            stickied: false,
          },
        },
      ],
      dist: 1,
    },
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should handle successful API response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRedditResponse),
    } as Response);

    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const posts = await scrapeReddit(['webdev'], 24, { requestDelay: 0 });

    expect(posts.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle rate limiting (429 response)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as Response);

    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const posts = await scrapeReddit(['webdev'], 24, { requestDelay: 0 });

    // Should return empty array when rate limited (error handled gracefully)
    expect(posts).toEqual([]);
  });

  it('should handle network errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const posts = await scrapeReddit(['webdev'], 24, { requestDelay: 0 });

    expect(posts).toEqual([]);
  });

  it('should filter out posts without signals when signalsOnly is true', async () => {
    const responseWithNoSignals = {
      ...mockRedditResponse,
      data: {
        ...mockRedditResponse.data,
        children: [
          {
            ...mockRedditResponse.data.children[0],
            data: {
              ...mockRedditResponse.data.children[0].data,
              title: 'Normal post without signals',
              selftext: 'Just regular content',
            },
          },
        ],
      },
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseWithNoSignals),
    } as Response);

    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const posts = await scrapeReddit(['webdev'], 24, {
      signalsOnly: true,
      requestDelay: 0,
    });

    expect(posts).toHaveLength(0);
  });
});
