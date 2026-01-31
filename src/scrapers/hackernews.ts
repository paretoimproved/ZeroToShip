/**
 * Hacker News Scraper for IdeaForge
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
import { type HNPost, PAIN_POINT_SIGNALS } from './types';

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
 * Normalize apostrophes (smart quotes to straight quotes)
 */
function normalizeApostrophes(text: string): string {
  return text.replace(/[\u2018\u2019\u0060\u00B4]/g, "'");
}

/**
 * Detect pain point signals in text
 */
function detectSignals(text: string): string[] {
  const normalizedText = normalizeApostrophes(text.toLowerCase());
  return PAIN_POINT_SIGNALS.filter(signal => {
    const normalizedSignal = normalizeApostrophes(signal.toLowerCase());
    return normalizedText.includes(normalizedSignal);
  });
}

/**
 * Check if text contains any pain point signals
 */
function hasPainPointSignals(text: string): boolean {
  return detectSignals(text).length > 0;
}

/**
 * Remove HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicate posts by sourceId
 */
function deduplicatePosts(posts: HNPost[]): HNPost[] {
  const seen = new Set<string>();
  return posts.filter(post => {
    if (seen.has(post.sourceId)) {
      return false;
    }
    seen.add(post.sourceId);
    return true;
  });
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
      const response = await searchAskHN(query, hoursBack, 0, 100);

      for (const hit of response.hits) {
        const post = hitToPost(hit);
        post.body = stripHtml(post.body);
        posts.push(post);
      }

      // Small delay between queries to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error scraping Ask HN for "${query}":`, error);
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
      const response = await searchComments(query, hoursBack, 0, 100);

      for (const hit of response.hits) {
        const post = hitToPost(hit);
        post.body = stripHtml(post.body);
        posts.push(post);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error scraping comments for "${query}":`, error);
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
    const showHNResponse = await searchShowHN(hoursBack, 0, 30);

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

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching Show HN item ${hit.objectID}:`, error);
      }
    }
  } catch (error) {
    console.error('Error scraping Show HN:', error);
  }

  return posts;
}

/**
 * Recursively extract comments with pain point signals
 */
function extractPainPointComments(children: HNItem[], storyTitle: string): HNPost[] {
  const posts: HNPost[] = [];

  for (const child of children) {
    if (child.text && hasPainPointSignals(child.text)) {
      const post = itemToPost(child, storyTitle);
      post.body = stripHtml(post.body);
      posts.push(post);
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
      const response = await searchStories(keyword, hoursBack, 0, 30);

      for (const hit of response.hits) {
        // Only include stories with significant engagement
        if ((hit.points || 0) >= 10 || (hit.num_comments || 0) >= 5) {
          const post = hitToPost(hit);
          post.body = stripHtml(post.body);
          posts.push(post);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Error scraping front page:', error);
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
  console.log(`[HN Scraper] Starting scrape with ${queries.length} queries, ${hoursBack}h window`);

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
    post => post.signals.length > 0 || (post.hnType === 'story' && post.score >= 50)
  );

  // Sort by score descending
  relevantPosts.sort((a, b) => b.score - a.score);

  console.log(`[HN Scraper] Found ${relevantPosts.length} relevant posts`);
  console.log(`  - Ask HN: ${askHNPosts.length}`);
  console.log(`  - Comments: ${commentPosts.length}`);
  console.log(`  - Show HN feedback: ${showHNPosts.length}`);
  console.log(`  - Front page: ${frontPagePosts.length}`);

  return relevantPosts;
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
  hasPainPointSignals,
  stripHtml,
  deduplicatePosts,
  extractPainPointComments,
};
