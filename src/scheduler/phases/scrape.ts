/**
 * Scrape Phase Runner
 *
 * Runs all enabled scrapers in parallel and combines results.
 */

import type { RawPost, HNPost, Tweet, GitHubIssue } from '../../scrapers/types';
import { scrapeReddit, DEFAULT_SUBREDDITS } from '../../scrapers/reddit';
import { scrapeHackerNews } from '../../scrapers/hackernews';
import { twitterScraper } from '../../scrapers/twitter';
import { scrapeGitHub } from '../../scrapers/github';
import { createPhaseLogger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { ScraperError, wrapError } from '../../lib/errors';
import type {
  PhaseResult,
  ScrapePhaseOutput,
  PipelineConfig,
} from '../types';

interface ScraperResult {
  name: 'reddit' | 'hn' | 'twitter' | 'github';
  posts: RawPost[];
  success: boolean;
  error?: string;
}

/**
 * Run a single scraper with retry logic
 */
async function runScraper<T extends RawPost>(
  name: 'reddit' | 'hn' | 'twitter' | 'github',
  scraperFn: () => Promise<T[]>
): Promise<ScraperResult> {
  try {
    const posts = await withRetry(scraperFn, { maxAttempts: 2 }, `scraper:${name}`);
    return { name, posts, success: true };
  } catch (error) {
    const scraperError = wrapError(error, ScraperError, { scraper: name });
    return {
      name,
      posts: [],
      success: false,
      error: scraperError.message,
    };
  }
}

/**
 * Deduplicate posts by source and sourceId
 */
function deduplicatePosts(posts: RawPost[]): RawPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = `${post.source}:${post.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Run the scrape phase
 */
export async function runScrapePhase(
  runId: string,
  config: PipelineConfig
): Promise<PhaseResult<ScrapePhaseOutput>> {
  const logger = createPhaseLogger(runId, 'scrape');
  const startTime = Date.now();

  logger.info(
    { hoursBack: config.hoursBack, scrapers: config.scrapers },
    'Starting scrape phase'
  );

  const scraperPromises: Promise<ScraperResult>[] = [];

  // Queue enabled scrapers
  if (config.scrapers.reddit) {
    scraperPromises.push(
      runScraper('reddit', () =>
        scrapeReddit([...DEFAULT_SUBREDDITS], config.hoursBack)
      )
    );
  }

  if (config.scrapers.hn) {
    scraperPromises.push(
      runScraper('hn', () => scrapeHackerNews(undefined, config.hoursBack))
    );
  }

  if (config.scrapers.twitter) {
    scraperPromises.push(
      runScraper('twitter', async () => {
        const result = await twitterScraper.scrapeAll(config.hoursBack);
        return result.tweets;
      })
    );
  }

  if (config.scrapers.github) {
    scraperPromises.push(
      runScraper('github', () =>
        // GitHub needs at least 90 days of data
        scrapeGitHub(undefined, Math.max(config.hoursBack, 2160))
      )
    );
  }

  // Run all scrapers in parallel — allSettled ensures one failure can't abort others
  const settled = await Promise.allSettled(scraperPromises);

  // Aggregate results
  const allPosts: RawPost[] = [];
  const output: ScrapePhaseOutput = {
    reddit: { count: 0, success: false },
    hn: { count: 0, success: false },
    twitter: { count: 0, success: false },
    github: { count: 0, success: false },
    totalPosts: 0,
    posts: [],
  };

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      const result = outcome.value;
      output[result.name] = {
        count: result.posts.length,
        success: result.success,
        error: result.error,
      };

      if (result.success) {
        allPosts.push(...result.posts);
        logger.info(
          { scraper: result.name, count: result.posts.length },
          'Scraper completed successfully'
        );
      } else {
        logger.warn(
          { scraper: result.name, error: result.error },
          'Scraper failed'
        );
      }
    } else {
      // Unexpected rejection — runScraper should catch all errors,
      // but allSettled guards against unforeseen failures
      const error = wrapError(outcome.reason, ScraperError, {
        note: 'Unexpected rejection in scraper promise',
      });
      logger.error(
        { error: error.message },
        'Scraper promise rejected unexpectedly'
      );
    }
  }

  output.posts = deduplicatePosts(allPosts);
  output.totalPosts = output.posts.length;

  const duration = Date.now() - startTime;
  const success = output.totalPosts > 0; // Success if we got any posts

  logger.info(
    { totalPosts: output.totalPosts, duration, success },
    'Scrape phase complete'
  );

  return {
    success,
    data: output,
    severity: success ? undefined : 'fatal',
    duration,
    phase: 'scrape',
    timestamp: new Date(),
    error: success ? undefined : 'No posts scraped from any source',
  };
}
