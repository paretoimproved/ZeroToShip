/**
 * Reddit Scraper for IdeaForge
 *
 * Scrapes subreddits for posts containing pain points and product ideas
 * using Reddit's JSON API (append .json to any URL).
 */

import { RawPost } from './types';
import { detectSignals, hasSignals } from './signals';
import logger from '../lib/logger';

/**
 * Reddit API listing response structure
 */
interface RedditListing {
  kind: 'Listing';
  data: {
    after: string | null;
    before: string | null;
    children: RedditPostWrapper[];
    dist: number;
  };
}

interface RedditPostWrapper {
  kind: 't3';
  data: RedditPostData;
}

interface RedditPostData {
  id: string;
  name: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  subreddit: string;
  url: string;
  is_self: boolean;
  over_18: boolean;
  stickied: boolean;
}

/**
 * Default subreddits to scrape for pain points
 */
export const DEFAULT_SUBREDDITS = [
  'SideProject',
  'startups',
  'Entrepreneur',
  'webdev',
  'programming',
  'devops',
  'selfhosted',
  'software',
] as const;

/**
 * Configuration for the Reddit scraper
 */
export interface RedditScraperConfig {
  /** User agent string (required by Reddit API) */
  userAgent?: string;
  /** Delay between requests in ms (default: 1000 for rate limiting) */
  requestDelay?: number;
  /** Maximum posts per subreddit (default: 100) */
  postsPerSubreddit?: number;
  /** Only include posts with signals (default: true) */
  signalsOnly?: boolean;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
}

const DEFAULT_CONFIG: Required<RedditScraperConfig> = {
  userAgent: 'IdeaForge/1.0 (Pain Point Discovery Bot)',
  requestDelay: 1000, // 1 second between requests (60/min rate limit)
  postsPerSubreddit: 100,
  signalsOnly: true,
  timeout: 10000,
};

/**
 * Generate a UUID v4
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON from a URL with proper headers
 */
async function fetchJson<T>(
  url: string,
  userAgent: string,
  timeout: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMITED: Reddit API rate limit exceeded');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Convert Reddit post data to RawPost format
 */
function toRawPost(data: RedditPostData, scrapedAt: Date): RawPost {
  const fullText = `${data.title} ${data.selftext}`;
  const signals = detectSignals(fullText);

  return {
    id: generateId(),
    source: 'reddit',
    sourceId: data.id,
    title: data.title,
    body: data.selftext || '',
    url: `https://reddit.com${data.permalink}`,
    author: data.author,
    score: data.score,
    commentCount: data.num_comments,
    createdAt: new Date(data.created_utc * 1000),
    scrapedAt,
    subreddit: data.subreddit,
    signals,
  };
}

/**
 * Scrape a single subreddit
 */
async function scrapeSubreddit(
  subreddit: string,
  hoursBack: number,
  config: Required<RedditScraperConfig>
): Promise<RawPost[]> {
  const posts: RawPost[] = [];
  const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
  const scrapedAt = new Date();

  let after: string | null = null;
  let pageCount = 0;
  const maxPages = Math.ceil(config.postsPerSubreddit / 25); // Reddit returns ~25 posts per page

  while (pageCount < maxPages) {
    // Build URL with pagination
    let url = `https://www.reddit.com/r/${subreddit}/new.json?limit=100`;
    if (after) {
      url += `&after=${after}`;
    }

    try {
      const listing = await fetchJson<RedditListing>(
        url,
        config.userAgent,
        config.timeout
      );

      if (!listing.data?.children?.length) {
        break;
      }

      let reachedCutoff = false;

      for (const wrapper of listing.data.children) {
        const postData = wrapper.data;

        // Skip stickied posts
        if (postData.stickied) continue;

        // Skip NSFW posts
        if (postData.over_18) continue;

        // Skip deleted/removed posts
        if (postData.author === '[deleted]') continue;

        // Check time cutoff
        const postTime = postData.created_utc * 1000;
        if (postTime < cutoffTime) {
          reachedCutoff = true;
          break;
        }

        const post = toRawPost(postData, scrapedAt);

        // Filter by signals if configured
        if (config.signalsOnly && post.signals.length === 0) {
          continue;
        }

        posts.push(post);

        // Stop if we have enough posts
        if (posts.length >= config.postsPerSubreddit) {
          break;
        }
      }

      // Stop conditions
      if (
        reachedCutoff ||
        posts.length >= config.postsPerSubreddit ||
        !listing.data.after
      ) {
        break;
      }

      after = listing.data.after;
      pageCount++;

      // Rate limiting delay
      await sleep(config.requestDelay);
    } catch (error) {
      logger.error({ err: error, subreddit }, `Error scraping r/${subreddit}`);
      break;
    }
  }

  return posts;
}

/**
 * Main scrape function - scrapes multiple subreddits
 *
 * @param subreddits - Array of subreddit names to scrape (without r/)
 * @param hoursBack - How many hours back to scrape (default: 24)
 * @param config - Optional configuration overrides
 * @returns Array of RawPost objects with detected signals
 *
 * @example
 * ```ts
 * const posts = await scrapeReddit(['webdev', 'programming'], 24);
 * console.log(`Found ${posts.length} posts with pain points`);
 * ```
 */
export async function scrapeReddit(
  subreddits: string[] = [...DEFAULT_SUBREDDITS],
  hoursBack: number = 24,
  config: RedditScraperConfig = {}
): Promise<RawPost[]> {
  const mergedConfig: Required<RedditScraperConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const allPosts: RawPost[] = [];

  logger.info({ subredditCount: subreddits.length, hoursBack }, 'Starting Reddit scrape');

  for (const subreddit of subreddits) {
    logger.info({ subreddit }, `Scraping r/${subreddit}...`);

    try {
      const posts = await scrapeSubreddit(subreddit, hoursBack, mergedConfig);
      allPosts.push(...posts);
      logger.info({ subreddit, count: posts.length }, `Found ${posts.length} posts with signals in r/${subreddit}`);

      // Rate limiting between subreddits
      await sleep(mergedConfig.requestDelay);
    } catch (error) {
      logger.error({ err: error, subreddit }, `Failed to scrape r/${subreddit}`);
    }
  }

  logger.info({ total: allPosts.length }, 'Reddit scrape complete');

  // Deduplicate by sourceId (in case same post appears in multiple places)
  const seen = new Set<string>();
  const uniquePosts = allPosts.filter((post) => {
    if (seen.has(post.sourceId)) return false;
    seen.add(post.sourceId);
    return true;
  });

  return uniquePosts;
}

/**
 * Scrape all default subreddits
 */
export async function scrapeAllDefaults(
  hoursBack: number = 24,
  config?: RedditScraperConfig
): Promise<RawPost[]> {
  return scrapeReddit([...DEFAULT_SUBREDDITS], hoursBack, config);
}

/**
 * Filter posts that contain specific signal categories
 */
export function filterBySignalCategory(
  posts: RawPost[],
  patterns: string[]
): RawPost[] {
  const lowerPatterns = patterns.map((p) => p.toLowerCase());

  return posts.filter((post) =>
    post.signals.some((signal) =>
      lowerPatterns.some((pattern) => signal.toLowerCase().includes(pattern))
    )
  );
}

/**
 * Sort posts by signal strength (number of signals * score)
 */
export function sortBySignalStrength(posts: RawPost[]): RawPost[] {
  return [...posts].sort((a, b) => {
    const scoreA = a.signals.length * Math.log10(Math.max(a.score, 1) + 1);
    const scoreB = b.signals.length * Math.log10(Math.max(b.score, 1) + 1);
    return scoreB - scoreA;
  });
}

/**
 * Get summary statistics from scrape results
 */
export function getScrapeStats(posts: RawPost[]): {
  totalPosts: number;
  bySubreddit: Record<string, number>;
  bySignal: Record<string, number>;
  avgScore: number;
  avgComments: number;
} {
  const bySubreddit: Record<string, number> = {};
  const bySignal: Record<string, number> = {};
  let totalScore = 0;
  let totalComments = 0;

  for (const post of posts) {
    // Count by subreddit
    const sub = post.subreddit || 'unknown';
    bySubreddit[sub] = (bySubreddit[sub] || 0) + 1;

    // Count by signal
    for (const signal of post.signals) {
      bySignal[signal] = (bySignal[signal] || 0) + 1;
    }

    totalScore += post.score;
    totalComments += post.commentCount;
  }

  return {
    totalPosts: posts.length,
    bySubreddit,
    bySignal,
    avgScore: posts.length > 0 ? totalScore / posts.length : 0,
    avgComments: posts.length > 0 ? totalComments / posts.length : 0,
  };
}
