/**
 * Tests for Twitter/X Scraper
 *
 * Run with: npm test -- tests/scrapers/twitter.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Tweet, PAIN_POINT_SIGNALS } from '../../src/scrapers/types.js';
import { _resetConfigForTesting } from '../../src/config/env';

// Mock the fetch function for API tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock data
const mockApiTweet = {
  id: '123456789',
  text: 'I wish there was a tool that could help with CI debugging locally. So frustrated with pushing commits just to see CI fail!',
  created_at: '2026-01-31T10:00:00.000Z',
  author_id: 'user123',
  public_metrics: {
    retweet_count: 15,
    reply_count: 8,
    like_count: 45,
    quote_count: 2,
  },
  conversation_id: 'conv123',
  entities: {
    hashtags: [{ tag: 'buildinpublic' }, { tag: 'devtools' }],
  },
};

const mockApiUser = {
  id: 'user123',
  username: 'dev_jane',
  public_metrics: {
    followers_count: 5000,
    following_count: 200,
    tweet_count: 1500,
  },
};

const mockApiResponse = {
  data: [mockApiTweet],
  includes: {
    users: [mockApiUser],
  },
  meta: {
    newest_id: '123456789',
    oldest_id: '123456789',
    result_count: 1,
  },
};

describe('Twitter Scraper Types', () => {
  it('should have correct Tweet interface structure', () => {
    const tweet: Tweet = {
      id: 'twitter_123',
      source: 'twitter',
      sourceId: '123',
      title: '',
      body: 'Test tweet',
      url: 'https://twitter.com/user/status/123',
      author: 'testuser',
      score: 10,
      commentCount: 5,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: ['wish there was'],
      likes: 5,
      retweets: 5,
      authorFollowers: 1000,
      hashtags: ['devtools'],
      isReply: false,
    };

    expect(tweet.source).toBe('twitter');
    expect(tweet.likes).toBe(5);
    expect(tweet.retweets).toBe(5);
    expect(tweet.authorFollowers).toBe(1000);
    expect(tweet.hashtags).toContain('devtools');
  });

  it('should have pain point signals defined', () => {
    expect(PAIN_POINT_SIGNALS.length).toBeGreaterThan(0);
    expect(PAIN_POINT_SIGNALS).toContain('wish there was');
    expect(PAIN_POINT_SIGNALS).toContain('frustrated with');
  });
});

describe('TwitterApiClient', async () => {
  const { TwitterApiClient } = await import('../../src/scrapers/twitter-api.js');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw error if no bearer token provided', () => {
    expect(() => new TwitterApiClient({})).toThrow('Twitter bearer token is required');
  });

  it('should create client with valid bearer token', () => {
    const client = new TwitterApiClient({ bearerToken: 'test_token' });
    expect(client).toBeDefined();
  });

  it('should search tweets and transform response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const client = new TwitterApiClient({ bearerToken: 'test_token' });
    const tweets = await client.searchTweets('test query', { maxResults: 10 });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(tweets).toHaveLength(1);

    const tweet = tweets[0];
    expect(tweet.source).toBe('twitter');
    expect(tweet.sourceId).toBe('123456789');
    expect(tweet.author).toBe('dev_jane');
    expect(tweet.likes).toBe(45);
    expect(tweet.retweets).toBe(15);
    expect(tweet.authorFollowers).toBe(5000);
    expect(tweet.hashtags).toContain('buildinpublic');
    expect(tweet.hashtags).toContain('devtools');
  });

  it('should handle API rate limit errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    const client = new TwitterApiClient({ bearerToken: 'test_token' });

    await expect(client.searchTweets('test')).rejects.toThrow('rate limit exceeded');
  });

  it('should handle authentication errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const client = new TwitterApiClient({ bearerToken: 'bad_token' });

    await expect(client.searchTweets('test')).rejects.toThrow('authentication failed');
  });

  it('should handle empty results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: { result_count: 0 },
      }),
    });

    const client = new TwitterApiClient({ bearerToken: 'test_token' });
    const tweets = await client.searchTweets('obscure query');

    expect(tweets).toHaveLength(0);
  });

  it('should detect pain point signals in tweets', async () => {
    const tweetWithSignals = {
      ...mockApiTweet,
      text: 'I wish there was a better way to debug. So frustrated with the current tools!',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [tweetWithSignals],
        includes: { users: [mockApiUser] },
        meta: { result_count: 1 },
      }),
    });

    const client = new TwitterApiClient({ bearerToken: 'test_token' });
    const tweets = await client.searchTweets('test');

    expect(tweets[0].signals).toContain('wish there was');
    expect(tweets[0].signals).toContain('frustrated');
  });
});

describe('NitterScraper', async () => {
  const { NitterScraper } = await import('../../src/scrapers/twitter-nitter.js');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create scraper with default instances', () => {
    const scraper = new NitterScraper();
    const instances = scraper.getInstances();
    expect(instances.length).toBeGreaterThan(0);
    expect(instances[0]).toContain('nitter');
  });

  it('should create scraper with custom instances', () => {
    const customInstances = ['https://custom.nitter.example.com'];
    const scraper = new NitterScraper({ nitterInstances: customInstances });
    const instances = scraper.getInstances();
    expect(instances).toEqual(customInstances);
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const scraper = new NitterScraper({
      nitterInstances: ['https://nitter1.test', 'https://nitter2.test'],
    });

    await expect(scraper.searchTweets('test')).rejects.toThrow();
  });

  it('should switch instances on failure', async () => {
    // First instance fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });
    // Second instance succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body></body></html>',
    });

    const scraper = new NitterScraper({
      nitterInstances: ['https://nitter1.test', 'https://nitter2.test'],
      rateLimitDelay: 0,
    });

    const tweets = await scraper.searchTweets('test');
    expect(tweets).toHaveLength(0); // Empty HTML, but no error
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should perform health check', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const scraper = new NitterScraper({
      nitterInstances: ['https://nitter.test'],
    });

    const result = await scraper.healthCheck();
    expect(result.healthy).toBe(true);
    expect(result.instance).toBe('https://nitter.test');
  });

  it('should report unhealthy when all instances fail', async () => {
    mockFetch.mockRejectedValue(new Error('All fail'));

    const scraper = new NitterScraper({
      nitterInstances: ['https://nitter.test'],
    });

    const result = await scraper.healthCheck();
    expect(result.healthy).toBe(false);
  });
});

describe('TwitterScraper (Main)', async () => {
  const { TwitterScraper } = await import('../../src/scrapers/twitter.js');

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variable
    delete process.env.TWITTER_BEARER_TOKEN;
    _resetConfigForTesting();
  });

  it('should create scraper without API token', () => {
    const scraper = new TwitterScraper();
    expect(scraper).toBeDefined();
  });

  it('should create scraper with API token', () => {
    const scraper = new TwitterScraper({ bearerToken: 'test_token' });
    expect(scraper).toBeDefined();
  });

  it('should get status of both methods', async () => {
    // Mock Nitter health check
    mockFetch.mockResolvedValue({ ok: true });

    const scraper = new TwitterScraper();
    const status = await scraper.getStatus();

    expect(status.api).toBeDefined();
    expect(status.nitter).toBeDefined();
    expect(status.api.hasToken).toBe(false); // No token set
  });

  it('should set preferred method', () => {
    const scraper = new TwitterScraper();
    scraper.setPreferredMethod('nitter');
    // No direct way to verify, but it shouldn't throw
  });
});

describe('Tweet Filtering and Scoring', async () => {
  const { TwitterScraper } = await import('../../src/scrapers/twitter.js');

  it('should filter out spam tweets', async () => {
    // This tests the internal filtering logic
    const scraper = new TwitterScraper();

    // Create mock tweets with spam patterns
    const spamTweet: Tweet = {
      id: 'twitter_spam',
      source: 'twitter',
      sourceId: 'spam',
      title: '',
      body: 'FREE GIVEAWAY! Follow and retweet for a chance to win!',
      url: 'https://twitter.com/spam/status/123',
      author: 'spammer',
      score: 1000,
      commentCount: 500,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: [],
      likes: 1000,
      retweets: 500,
      authorFollowers: 10,
      hashtags: [],
      isReply: false,
    };

    const legitimateTweet: Tweet = {
      id: 'twitter_legit',
      source: 'twitter',
      sourceId: 'legit',
      title: '',
      body: 'I wish there was a better way to handle CI pipelines locally. Current tools are so frustrating.',
      url: 'https://twitter.com/dev/status/456',
      author: 'realdev',
      score: 50,
      commentCount: 10,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: ['wish there was', 'frustrating'],
      likes: 40,
      retweets: 10,
      authorFollowers: 2000,
      hashtags: ['devtools'],
      isReply: false,
    };

    // Access the private filter method via reflection (for testing)
    const filterMethod = (scraper as any).filterAndSortTweets.bind(scraper);
    const filtered = filterMethod([spamTweet, legitimateTweet]);

    // Spam should be filtered out
    expect(filtered.some((t: Tweet) => t.id === 'twitter_spam')).toBe(false);
    // Legitimate tweet should remain
    expect(filtered.some((t: Tweet) => t.id === 'twitter_legit')).toBe(true);
  });

  it('should filter out short tweets', async () => {
    const scraper = new TwitterScraper();

    const shortTweet: Tweet = {
      id: 'twitter_short',
      source: 'twitter',
      sourceId: 'short',
      title: '',
      body: 'Cool!',
      url: 'https://twitter.com/user/status/123',
      author: 'user',
      score: 10,
      commentCount: 1,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: [],
      likes: 10,
      retweets: 0,
      authorFollowers: 100,
      hashtags: [],
      isReply: false,
    };

    const filterMethod = (scraper as any).filterAndSortTweets.bind(scraper);
    const filtered = filterMethod([shortTweet]);

    expect(filtered).toHaveLength(0);
  });

  it('should sort tweets by relevance score', async () => {
    const scraper = new TwitterScraper();

    const lowEngagement: Tweet = {
      id: 'twitter_low',
      source: 'twitter',
      sourceId: 'low',
      title: '',
      body: 'This is a longer tweet with enough content to pass the filter but low engagement.',
      url: 'https://twitter.com/user1/status/1',
      author: 'user1',
      score: 5,
      commentCount: 1,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: [],
      likes: 5,
      retweets: 0,
      authorFollowers: 100,
      hashtags: [],
      isReply: false,
    };

    const highEngagement: Tweet = {
      id: 'twitter_high',
      source: 'twitter',
      sourceId: 'high',
      title: '',
      body: 'I wish there was a tool for this. The current situation is so frustrating for developers.',
      url: 'https://twitter.com/user2/status/2',
      author: 'user2',
      score: 100,
      commentCount: 20,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: ['wish there was', 'frustrating'],
      likes: 80,
      retweets: 20,
      authorFollowers: 5000,
      hashtags: ['buildinpublic'],
      isReply: false,
    };

    const filterMethod = (scraper as any).filterAndSortTweets.bind(scraper);
    const sorted = filterMethod([lowEngagement, highEngagement]);

    // High engagement tweet should come first
    expect(sorted[0].id).toBe('twitter_high');
  });
});

describe('Default Search Queries', async () => {
  const { DEFAULT_TWITTER_QUERIES } = await import('../../src/scrapers/twitter-api.js');

  it('should have multiple default queries', () => {
    expect(DEFAULT_TWITTER_QUERIES.length).toBeGreaterThan(5);
  });

  it('should have queries with descriptions', () => {
    for (const q of DEFAULT_TWITTER_QUERIES) {
      expect(q.query).toBeTruthy();
      expect(q.description).toBeTruthy();
    }
  });

  it('should include retweet filters', () => {
    for (const q of DEFAULT_TWITTER_QUERIES) {
      expect(q.query.toLowerCase()).toContain('-is:retweet');
    }
  });

  it('should include pain point patterns', () => {
    const patterns = ['wish', 'frustrated', 'pay for', 'why is there no'];
    const queriesString = DEFAULT_TWITTER_QUERIES.map(q => q.query.toLowerCase()).join(' ');

    for (const pattern of patterns) {
      expect(queriesString).toContain(pattern);
    }
  });
});
