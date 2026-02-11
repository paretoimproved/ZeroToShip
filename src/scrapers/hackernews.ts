/**
 * Hacker News Scraper for ZeroToShip
 *
 * Scrapes HN for pain points using the Algolia API:
 * - "Ask HN" posts from the last 24-48 hours
 * - Comments on "Show HN" posts
 * - Front page discussions about tools/products
 *
 * Searches for pain point signals like:
 * - "wish there was"
 * - "frustrated with"
 * - "looking for"
 * - "anyone know of"
 * - "I'd pay for"
 */

import {
  searchAskHN,
  searchComments,
  searchStories,
  searchShowHN,
  getItem,
  type HNAlgoliaHit,
  type HNItem,
} from './hn-api';
import { type HNPost } from './types';
import { detectSignals, hasSignals } from './signals';
import { isNonTechnicalContent } from './content-filter';
import logger from '../lib/logger';
import {
  sleep,
  stripHtml,
  deduplicatePosts,
  wrapScraperError,
  truncateResults,
} from './shared';

/** Default results per Algolia search query */
const ALGOLIA_RESULTS_PER_QUERY = 100;

/** Results per Show HN / front page query (smaller to reduce noise) */
const SHOW_HN_RESULTS_PER_QUERY = 30;

/** Delay between sequential Algolia queries (ms) */
const ALGOLIA_QUERY_DELAY_MS = 100;

/** Delay between Show HN item detail fetches (ms) */
const SHOW_HN_ITEM_DELAY_MS = 200;

/** Minimum HN points for an Ask HN post to be included */
const MIN_ASK_HN_POINTS = 2;

/** Minimum HN points for a front page story to be included */
const MIN_FRONT_PAGE_POINTS = 20;

/** Minimum HN comments for a front page story to be included */
const MIN_FRONT_PAGE_COMMENTS = 5;

/** Minimum score for a high-engagement story to bypass signal filter */
const HIGH_ENGAGEMENT_SCORE_THRESHOLD = 50;

/**
 * Default pain point search queries
 */
export const DEFAULT_QUERIES = [
  'wish there was',
  'frustrated with',
  'looking for',
  'anyone know of',
  "i'd pay for",
  'why isn\'t there',
  'hate having to',
  'struggling with',
  'need a tool',
  'better alternative',
  'painful to',
  'nobody has built',
  'biggest problem',
  'underserved',
  'broken workflow',
  // Expert-level queries targeting developers hitting real limits
  'impossible to debug',
  'wasted hours on',
  'why does every tool',
  'building my own because',
  'switched away from',
  'no good solution for',
  'hacked together',
  'workaround for',
  'should be easier',
  'reinventing the wheel',
  'keeps breaking',
  'doesn\'t scale',
] as const;

/**
 * Convert Algolia hit to HNPost
 */
function hitToPost(hit: HNAlgoliaHit): HNPost {
  const isComment = hit._tags.includes('comment');
  const text = isComment ? hit.comment_text || '' : hit.story_text || hit.title || '';
  const title = isComment ? hit.story_title || '' : hit.title || '';

  return {
    id: `hn-${hit.objectID}`,
    source: 'hn',
    sourceId: hit.objectID,
    title: title,
    body: text,
    url: isComment
      ? `https://news.ycombinator.com/item?id=${hit.objectID}`
      : hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    author: hit.author,
    score: hit.points || 0,
    commentCount: hit.num_comments || 0,
    createdAt: new Date(hit.created_at),
    scrapedAt: new Date(),
    signals: detectSignals(text + ' ' + title),
    hnType: isComment ? 'comment' : 'story',
    parentId: hit.parent_id?.toString(),
    storyTitle: hit.story_title,
  };
}

/**
 * Convert HN Item (from /items endpoint) to HNPost
 */
function itemToPost(item: HNItem, storyTitle?: string): HNPost {
  const isComment = item.type === 'comment';
  const text = item.text || item.title || '';

  return {
    id: `hn-${item.id}`,
    source: 'hn',
    sourceId: item.id.toString(),
    title: isComment ? storyTitle || '' : item.title || '',
    body: text,
    url: isComment
      ? `https://news.ycombinator.com/item?id=${item.id}`
      : item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    author: item.author,
    score: item.points || 0,
    commentCount: item.children?.length || 0,
    createdAt: new Date(item.created_at),
    scrapedAt: new Date(),
    signals: detectSignals(text),
    hnType: isComment ? 'comment' : 'story',
    parentId: item.parent_id?.toString(),
    storyTitle: storyTitle,
  };
}

/**
 * Scrape Ask HN posts matching queries
 */
async function scrapeAskHN(
  queries: string[],
  hoursBack: number
): Promise<HNPost[]> {
  const posts: HNPost[] = [];

  for (const query of queries) {
    try {
      const response = await searchAskHN(query, hoursBack, 0, ALGOLIA_RESULTS_PER_QUERY);

      for (const hit of response.hits) {
        if ((hit.points || 0) < MIN_ASK_HN_POINTS) continue;
        const post = hitToPost(hit);
        post.body = stripHtml(post.body);
        if (isNonTechnicalContent(post.title, post.body)) continue;
        posts.push(post);
      }

      await sleep(ALGOLIA_QUERY_DELAY_MS);
    } catch (error) {
      const scraperErr = wrapScraperError(error, 'hn', { query });
      logger.error({ err: scraperErr, query }, `Error scraping Ask HN for "${query}"`);
    }
  }

  return posts;
}

/**
 * Scrape comments matching pain point queries
 */
async function scrapeComments(
  queries: string[],
  hoursBack: number
): Promise<HNPost[]> {
  const posts: HNPost[] = [];

  for (const query of queries) {
    try {
      const response = await searchComments(query, hoursBack, 0, ALGOLIA_RESULTS_PER_QUERY);

      for (const hit of response.hits) {
        const post = hitToPost(hit);
        post.body = stripHtml(post.body);
        if (isNonTechnicalContent(post.title, post.body)) continue;
        posts.push(post);
      }

      await sleep(ALGOLIA_QUERY_DELAY_MS);
    } catch (error) {
      const scraperErr = wrapScraperError(error, 'hn', { query });
      logger.error({ err: scraperErr, query }, `Error scraping comments for "${query}"`);
    }
  }

  return posts;
}

/**
 * Scrape Show HN posts and their comments for feedback
 */
async function scrapeShowHNComments(hoursBack: number): Promise<HNPost[]> {
  const posts: HNPost[] = [];

  try {
    // Get recent Show HN posts
    const showHNResponse = await searchShowHN(hoursBack, 0, SHOW_HN_RESULTS_PER_QUERY);

    // For each Show HN, get comments that contain pain point signals
    for (const hit of showHNResponse.hits) {
      try {
        const item = await getItem(hit.objectID);

        // Check comments recursively for pain points
        const commentsWithPainPoints = extractPainPointComments(
          item.children || [],
          item.title || ''
        );

        posts.push(...commentsWithPainPoints);

        await sleep(SHOW_HN_ITEM_DELAY_MS);
      } catch (error) {
        const scraperErr = wrapScraperError(error, 'hn', { itemId: hit.objectID });
        logger.error({ err: scraperErr, itemId: hit.objectID }, `Error fetching Show HN item ${hit.objectID}`);
      }
    }
  } catch (error) {
    const scraperErr = wrapScraperError(error, 'hn');
    logger.error({ err: scraperErr }, 'Error scraping Show HN');
  }

  return posts;
}

/**
 * Recursively extract comments with pain point signals
 */
function extractPainPointComments(children: HNItem[], storyTitle: string): HNPost[] {
  const posts: HNPost[] = [];

  for (const child of children) {
    if (child.text && hasSignals(child.text)) {
      const post = itemToPost(child, storyTitle);
      post.body = stripHtml(post.body);
      if (!isNonTechnicalContent(post.title, post.body)) {
        posts.push(post);
      }
    }

    // Recurse into nested comments
    if (child.children && child.children.length > 0) {
      posts.push(...extractPainPointComments(child.children, storyTitle));
    }
  }

  return posts;
}

/**
 * Scrape front page discussions about tools/products
 */
async function scrapeFrontPage(hoursBack: number): Promise<HNPost[]> {
  const posts: HNPost[] = [];
  const toolKeywords = ['tool', 'app', 'service', 'product', 'software', 'cli', 'api'];

  try {
    // Search for stories about tools/products
    for (const keyword of toolKeywords) {
      const response = await searchStories(keyword, hoursBack, 0, SHOW_HN_RESULTS_PER_QUERY);

      for (const hit of response.hits) {
        // Only include stories with significant engagement
        if ((hit.points || 0) >= MIN_FRONT_PAGE_POINTS || (hit.num_comments || 0) >= MIN_FRONT_PAGE_COMMENTS) {
          const post = hitToPost(hit);
          post.body = stripHtml(post.body);
          posts.push(post);
        }
      }

      await sleep(ALGOLIA_QUERY_DELAY_MS);
    }
  } catch (error) {
    const scraperErr = wrapScraperError(error, 'hn');
    logger.error({ err: scraperErr }, 'Error scraping front page');
  }

  return posts;
}

/**
 * Main scraper function
 *
 * Scrapes Hacker News for posts and comments containing pain points.
 *
 * @param queries - Search queries for pain point signals (default: DEFAULT_QUERIES)
 * @param hoursBack - How many hours back to search (default: 48)
 * @returns Array of HNPost objects
 */
export async function scrapeHackerNews(
  queries: string[] = [...DEFAULT_QUERIES],
  hoursBack = 48
): Promise<HNPost[]> {
  logger.info({ queryCount: queries.length, hoursBack }, 'Starting HN scrape');

  const allPosts: HNPost[] = [];

  // Run scrapers in parallel
  const [askHNPosts, commentPosts, showHNPosts, frontPagePosts] = await Promise.all([
    scrapeAskHN(queries, hoursBack),
    scrapeComments(queries, hoursBack),
    scrapeShowHNComments(hoursBack),
    scrapeFrontPage(hoursBack),
  ]);

  allPosts.push(...askHNPosts);
  allPosts.push(...commentPosts);
  allPosts.push(...showHNPosts);
  allPosts.push(...frontPagePosts);

  // Deduplicate
  const uniquePosts = deduplicatePosts(allPosts);

  // Filter to only posts with pain point signals (unless they're high-engagement stories)
  const relevantPosts = uniquePosts.filter(
    post => post.signals.length > 0 || (post.hnType === 'story' && post.score >= HIGH_ENGAGEMENT_SCORE_THRESHOLD)
  );

  // Sort by score descending
  relevantPosts.sort((a, b) => b.score - a.score);

  // Truncate to MAX_POSTS_PER_SOURCE to prevent OOM and control downstream costs
  const truncated = truncateResults(relevantPosts);

  logger.info({ total: truncated.length, askHN: askHNPosts.length, comments: commentPosts.length, showHN: showHNPosts.length, frontPage: frontPagePosts.length }, 'HN scrape complete');

  return truncated;
}

/**
 * Quick scrape - faster but less thorough
 * Useful for testing or when you need quick results
 */
export async function scrapeHackerNewsQuick(hoursBack = 24): Promise<HNPost[]> {
  const quickQueries = [
    'wish there was',
    'frustrated with',
    "i'd pay for",
  ];

  return scrapeHackerNews(quickQueries, hoursBack);
}

/**
 * Export individual scrapers for testing
 */
export const _internal = {
  scrapeAskHN,
  scrapeComments,
  scrapeShowHNComments,
  scrapeFrontPage,
  hitToPost,
  itemToPost,
  detectSignals,
  hasPainPointSignals: hasSignals,
  stripHtml,
  deduplicatePosts,
  extractPainPointComments,
};
