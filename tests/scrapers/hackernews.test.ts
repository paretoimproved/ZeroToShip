/**
 * Tests for Hacker News Scraper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scrapeHackerNews,
  scrapeHackerNewsQuick,
  DEFAULT_QUERIES,
  _internal,
} from '../../src/scrapers/hackernews';
import type { HNAlgoliaHit, HNItem } from '../../src/scrapers/hn-api';
import type { HNPost } from '../../src/scrapers/types';

// Mock the hn-api module
vi.mock('../../src/scrapers/hn-api', () => ({
  searchAskHN: vi.fn(),
  searchComments: vi.fn(),
  searchShowHN: vi.fn(),
  searchStories: vi.fn(),
  getItem: vi.fn(),
}));

import * as hnApi from '../../src/scrapers/hn-api';

const mockedSearchAskHN = vi.mocked(hnApi.searchAskHN);
const mockedSearchComments = vi.mocked(hnApi.searchComments);
const mockedSearchShowHN = vi.mocked(hnApi.searchShowHN);
const mockedSearchStories = vi.mocked(hnApi.searchStories);
const mockedGetItem = vi.mocked(hnApi.getItem);

// Helper to create mock Algolia hits
function createMockHit(overrides: Partial<HNAlgoliaHit> = {}): HNAlgoliaHit {
  return {
    objectID: '12345',
    title: 'Test Post',
    author: 'testuser',
    points: 100,
    story_text: 'I wish there was a better tool for this.',
    num_comments: 50,
    created_at: '2026-01-31T10:00:00.000Z',
    created_at_i: Math.floor(Date.now() / 1000),
    _tags: ['story', 'author_testuser'],
    ...overrides,
  };
}

// Helper to create mock HN items
function createMockItem(overrides: Partial<HNItem> = {}): HNItem {
  return {
    id: 12345,
    created_at: '2026-01-31T10:00:00.000Z',
    created_at_i: Math.floor(Date.now() / 1000),
    type: 'comment',
    author: 'testuser',
    text: 'I wish there was a better solution.',
    points: null,
    children: [],
    ...overrides,
  };
}

// Helper to create empty API response
function createEmptyResponse() {
  return {
    hits: [],
    nbHits: 0,
    page: 0,
    nbPages: 0,
    hitsPerPage: 50,
    exhaustiveNbHits: true,
    query: '',
    params: '',
  };
}

describe('HN Scraper Internal Functions', () => {
  describe('detectSignals', () => {
    it('should detect pain point signals in text', () => {
      const text = 'I wish there was a better tool for managing configs';
      const signals = _internal.detectSignals(text);

      expect(signals).toContain('wish there was');
    });

    it('should detect multiple signals', () => {
      const text = 'I wish there was something. So frustrated with current tools.';
      const signals = _internal.detectSignals(text);

      expect(signals).toContain('wish there was');
      expect(signals).toContain('frustrated with');
      expect(signals.length).toBe(2);
    });

    it('should return empty array for no signals', () => {
      const text = 'This is a great tool that works perfectly.';
      const signals = _internal.detectSignals(text);

      expect(signals).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const text = "I'D PAY FOR a tool like this";
      const signals = _internal.detectSignals(text);

      expect(signals).toContain("i'd pay for");
    });
  });

  describe('hasPainPointSignals', () => {
    it('should return true when signals exist', () => {
      expect(_internal.hasPainPointSignals('I wish there was something')).toBe(true);
    });

    it('should return false when no signals exist', () => {
      expect(_internal.hasPainPointSignals('Great product!')).toBe(false);
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      const html = '<p>Hello <strong>world</strong></p>';
      expect(_internal.stripHtml(html)).toBe('Hello world');
    });

    it('should decode HTML entities', () => {
      const html = 'Hello &amp; goodbye &quot;friend&quot;';
      expect(_internal.stripHtml(html)).toBe('Hello & goodbye "friend"');
    });

    it('should normalize whitespace', () => {
      const html = 'Hello    \n\n   world';
      expect(_internal.stripHtml(html)).toBe('Hello world');
    });
  });

  describe('hitToPost', () => {
    it('should convert story hit to HNPost', () => {
      const hit = createMockHit({
        objectID: '99999',
        title: 'Ask HN: Looking for a better CI tool',
        story_text: 'I wish there was a simpler CI solution.',
        _tags: ['story', 'ask_hn', 'author_testuser'],
      });

      const post = _internal.hitToPost(hit);

      expect(post.id).toBe('hn-99999');
      expect(post.source).toBe('hn');
      expect(post.sourceId).toBe('99999');
      expect(post.hnType).toBe('story');
      expect(post.title).toBe('Ask HN: Looking for a better CI tool');
      expect(post.signals).toContain('wish there was');
    });

    it('should convert comment hit to HNPost', () => {
      const hit = createMockHit({
        objectID: '88888',
        comment_text: "I'd pay for something that actually works.",
        story_title: 'Show HN: My new tool',
        parent_id: 77777,
        _tags: ['comment', 'author_testuser'],
      });

      const post = _internal.hitToPost(hit);

      expect(post.hnType).toBe('comment');
      expect(post.parentId).toBe('77777');
      expect(post.storyTitle).toBe('Show HN: My new tool');
      expect(post.signals).toContain("i'd pay for");
    });
  });

  describe('deduplicatePosts', () => {
    it('should remove duplicate posts by sourceId', () => {
      const posts: HNPost[] = [
        { sourceId: '1', id: 'hn-1' } as HNPost,
        { sourceId: '2', id: 'hn-2' } as HNPost,
        { sourceId: '1', id: 'hn-1-dup' } as HNPost,
      ];

      const unique = _internal.deduplicatePosts(posts);

      expect(unique).toHaveLength(2);
      expect(unique.map(p => p.sourceId)).toEqual(['1', '2']);
    });
  });

  describe('extractPainPointComments', () => {
    it('should extract comments with pain point signals', () => {
      const children: HNItem[] = [
        createMockItem({
          id: 1,
          text: 'I wish there was a better way.',
        }),
        createMockItem({
          id: 2,
          text: 'Great work!',
        }),
      ];

      const posts = _internal.extractPainPointComments(children, 'Test Story');

      expect(posts).toHaveLength(1);
      expect(posts[0].sourceId).toBe('1');
    });

    it('should extract nested comments recursively', () => {
      const children: HNItem[] = [
        createMockItem({
          id: 1,
          text: 'I wish there was a tool.',
          children: [
            createMockItem({
              id: 2,
              text: "I'd pay for something like that.",
            }),
          ],
        }),
      ];

      const posts = _internal.extractPainPointComments(children, 'Test Story');

      expect(posts).toHaveLength(2);
    });
  });
});

describe('HN Scraper Main Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default empty responses
    mockedSearchAskHN.mockResolvedValue(createEmptyResponse());
    mockedSearchComments.mockResolvedValue(createEmptyResponse());
    mockedSearchShowHN.mockResolvedValue(createEmptyResponse());
    mockedSearchStories.mockResolvedValue(createEmptyResponse());
    mockedGetItem.mockResolvedValue(createMockItem({ children: [] }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scrapeHackerNews', () => {
    it('should call all scrapers in parallel', async () => {
      await scrapeHackerNews(['wish there was'], 24);

      expect(mockedSearchAskHN).toHaveBeenCalled();
      expect(mockedSearchComments).toHaveBeenCalled();
      expect(mockedSearchShowHN).toHaveBeenCalled();
      expect(mockedSearchStories).toHaveBeenCalled();
    });

    it('should use default queries when none provided', async () => {
      await scrapeHackerNews();

      // Should call with each default query
      expect(mockedSearchAskHN).toHaveBeenCalledTimes(DEFAULT_QUERIES.length);
    });

    it('should return posts sorted by score', async () => {
      mockedSearchAskHN.mockResolvedValue({
        ...createEmptyResponse(),
        hits: [
          createMockHit({ objectID: '1', points: 10 }),
          createMockHit({ objectID: '2', points: 100 }),
          createMockHit({ objectID: '3', points: 50 }),
        ],
      });

      const posts = await scrapeHackerNews(['test'], 24);

      expect(posts[0].score).toBe(100);
      expect(posts[1].score).toBe(50);
      expect(posts[2].score).toBe(10);
    });

    it('should deduplicate posts from different sources', async () => {
      const hit = createMockHit({ objectID: '12345' });

      mockedSearchAskHN.mockResolvedValue({
        ...createEmptyResponse(),
        hits: [hit],
      });
      mockedSearchComments.mockResolvedValue({
        ...createEmptyResponse(),
        hits: [hit], // Same post from comments search
      });

      const posts = await scrapeHackerNews(['test'], 24);

      expect(posts.filter(p => p.sourceId === '12345')).toHaveLength(1);
    });

    it('should include high-engagement stories without signals', async () => {
      mockedSearchStories.mockResolvedValue({
        ...createEmptyResponse(),
        hits: [
          createMockHit({
            objectID: '1',
            points: 100,
            story_text: 'No pain points here, just a great tool.',
          }),
        ],
      });

      const posts = await scrapeHackerNews(['test'], 24);

      // Should include because score >= 50
      expect(posts.some(p => p.sourceId === '1')).toBe(true);
    });

    it('should scrape Show HN comments for feedback', async () => {
      mockedSearchShowHN.mockResolvedValue({
        ...createEmptyResponse(),
        hits: [createMockHit({ objectID: '55555' })],
      });

      mockedGetItem.mockResolvedValue({
        ...createMockItem(),
        id: 55555,
        title: 'Show HN: My Tool',
        children: [
          createMockItem({
            id: 66666,
            text: 'I wish there was better documentation.',
          }),
        ],
      });

      const posts = await scrapeHackerNews(['test'], 24);

      expect(mockedGetItem).toHaveBeenCalledWith('55555');
      expect(posts.some(p => p.sourceId === '66666')).toBe(true);
    });
  });

  describe('scrapeHackerNewsQuick', () => {
    it('should use reduced query set', async () => {
      await scrapeHackerNewsQuick(24);

      // Quick scrape uses only 3 queries
      expect(mockedSearchAskHN).toHaveBeenCalledTimes(3);
    });

    it('should default to 24 hours', async () => {
      await scrapeHackerNewsQuick();

      const call = mockedSearchAskHN.mock.calls[0];
      expect(call[1]).toBe(24); // hoursBack parameter
    });
  });
});

describe('DEFAULT_QUERIES', () => {
  it('should contain expected pain point phrases', () => {
    expect(DEFAULT_QUERIES).toContain('wish there was');
    expect(DEFAULT_QUERIES).toContain('frustrated with');
    expect(DEFAULT_QUERIES).toContain('looking for');
    expect(DEFAULT_QUERIES).toContain("i'd pay for");
  });

  it('should have at least 5 queries', () => {
    expect(DEFAULT_QUERIES.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Integration-style Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle API errors gracefully', async () => {
    mockedSearchAskHN.mockRejectedValue(new Error('API Error'));
    mockedSearchComments.mockResolvedValue(createEmptyResponse());
    mockedSearchShowHN.mockResolvedValue(createEmptyResponse());
    mockedSearchStories.mockResolvedValue(createEmptyResponse());

    // Should not throw, just return whatever it could get
    const posts = await scrapeHackerNews(['test'], 24);

    expect(Array.isArray(posts)).toBe(true);
  });

  it('should handle empty results', async () => {
    mockedSearchAskHN.mockResolvedValue(createEmptyResponse());
    mockedSearchComments.mockResolvedValue(createEmptyResponse());
    mockedSearchShowHN.mockResolvedValue(createEmptyResponse());
    mockedSearchStories.mockResolvedValue(createEmptyResponse());

    const posts = await scrapeHackerNews(['test'], 24);

    expect(posts).toHaveLength(0);
  });

  it('should produce valid HNPost objects', async () => {
    mockedSearchAskHN.mockResolvedValue({
      ...createEmptyResponse(),
      hits: [
        createMockHit({
          objectID: '99999',
          title: 'Ask HN: Best tools for X?',
          story_text: 'I wish there was something better.',
          author: 'developer',
          points: 42,
          num_comments: 15,
          created_at: '2026-01-31T08:00:00.000Z',
        }),
      ],
    });

    const posts = await scrapeHackerNews(['wish'], 24);

    expect(posts).toHaveLength(1);

    const post = posts[0];
    expect(post.id).toBe('hn-99999');
    expect(post.source).toBe('hn');
    expect(post.sourceId).toBe('99999');
    expect(post.title).toBe('Ask HN: Best tools for X?');
    expect(post.author).toBe('developer');
    expect(post.score).toBe(42);
    expect(post.commentCount).toBe(15);
    expect(post.hnType).toBe('story');
    expect(post.signals).toContain('wish there was');
    expect(post.createdAt).toBeInstanceOf(Date);
    expect(post.scrapedAt).toBeInstanceOf(Date);
    expect(post.url).toContain('news.ycombinator.com');
  });
});
