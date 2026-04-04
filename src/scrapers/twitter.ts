/**
 * Twitter/X Scraper for ZeroToShip
 *
 * Main orchestrator that combines Twitter API v2 and Nitter fallback
 * to collect developer complaints and wishlists.
 *
 * Usage:
 *   import { scrapeTwitter, twitterScraper } from './twitter.js';
 *
 *   // Quick usage
 *   const tweets = await scrapeTwitter(['frustrated with', 'wish there was'], 24);
 *
 *   // Or use the class for more control
 *   const scraper = new TwitterScraper();
 *   const tweets = await scraper.scrapeAll();
 */

import { config } from 'dotenv';
import { Tweet, TwitterConfig, TwitterSearchQuery } from './types';
import { hasSignals } from './signals';
import { TwitterApiClient, createTwitterApiClient, DEFAULT_TWITTER_QUERIES } from './twitter-api';
import { NitterScraper, createNitterScraper } from './twitter-nitter';
import logger from '../lib/logger';
import { ScraperError } from '../lib/errors';
import { wrapScraperError, getCutoffDate, truncateResults } from './shared';

// Load environment variables
config();

/** Minimum tweet body length to avoid very short / empty tweets */
const MIN_TWEET_LENGTH = 30;

/** Minimum text length after removing links and mentions */
const MIN_CLEAN_TEXT_LENGTH = 20;

/** Engagement weight multipliers for relevance scoring */
const LIKE_WEIGHT = 2;
const RETWEET_WEIGHT = 3;
const COMMENT_WEIGHT = 5;
const SIGNAL_BONUS = 20;
const HASHTAG_BONUS = 10;

/** Follower thresholds for credibility bonuses */
const FOLLOWER_THRESHOLD_MEDIUM = 1000;
const FOLLOWER_THRESHOLD_HIGH = 10_000;
const FOLLOWER_BONUS_MEDIUM = 10;
const FOLLOWER_BONUS_HIGH = 20;

/** Recency bonus thresholds (hours old) and bonus values */
const RECENCY_HOURS_FRESH = 6;
const RECENCY_HOURS_RECENT = 12;
const RECENCY_BONUS_FRESH = 15;
const RECENCY_BONUS_RECENT = 10;

/**
 * Scraper method type
 */
type ScraperMethod = 'api' | 'nitter' | 'auto';

/**
 * Scraper result with metadata
 */
export interface TwitterScraperResult {
  tweets: Tweet[];
  method: ScraperMethod;
  totalFound: number;
  errors: string[];
  duration: number;
  queriesUsed: string[];
}

/**
 * Main Twitter scraper class
 */
export class TwitterScraper {
  private apiClient: TwitterApiClient | null;
  private nitterScraper: NitterScraper;
  private preferredMethod: ScraperMethod = 'auto';

  constructor(config: TwitterConfig = {}) {
    this.apiClient = createTwitterApiClient(config.bearerToken);
    this.nitterScraper = createNitterScraper(config.nitterInstances);
  }

  /**
   * Scrape Twitter using custom queries
   */
  async scrapeQueries(
    queries: string[],
    hoursBack: number = 24,
    maxResultsPerQuery: number = 50
  ): Promise<Tweet[]> {
    const startTime = getCutoffDate(hoursBack);
    const allTweets: Tweet[] = [];
    const seenIds = new Set<string>();

    for (const query of queries) {
      try {
        const tweets = await this.searchWithFallback(query, {
          maxResults: maxResultsPerQuery,
          startTime,
        });

        // Deduplicate
        for (const tweet of tweets) {
          if (!seenIds.has(tweet.sourceId)) {
            seenIds.add(tweet.sourceId);
            allTweets.push(tweet);
          }
        }
      } catch (error) {
        const scraperErr = wrapScraperError(error, 'twitter', { query });
        logger.error({ err: scraperErr, query }, `Error searching for "${query}"`);
      }
    }

    return this.filterAndSortTweets(allTweets);
  }

  /**
   * Scrape using default developer pain point queries
   */
  async scrapeAll(
    hoursBack: number = 24,
    maxResultsPerQuery: number = 50
  ): Promise<TwitterScraperResult> {
    const startTime = Date.now();
    const startDate = getCutoffDate(hoursBack);
    const allTweets: Tweet[] = [];
    const seenIds = new Set<string>();
    const errors: string[] = [];
    const queriesUsed: string[] = [];
    let methodUsed: ScraperMethod = 'auto';

    // Determine which method to use
    const apiAvailable = await this.isApiAvailable();

    if (this.preferredMethod === 'api' && !apiAvailable) {
      errors.push('Twitter API requested but not available, falling back to Nitter');
    }

    if (this.preferredMethod === 'nitter') {
      methodUsed = 'nitter';
    } else if (apiAvailable) {
      methodUsed = 'api';
    } else {
      methodUsed = 'nitter';
    }

    logger.info(`Using ${methodUsed} method for Twitter scraping`);

    // Process default queries
    for (const { query, description } of DEFAULT_TWITTER_QUERIES) {
      try {
        logger.info(`Searching: ${description}...`);
        queriesUsed.push(query);

        const tweets = await this.searchWithFallback(query, {
          maxResults: maxResultsPerQuery,
          startTime: startDate,
        });

        // Deduplicate
        for (const tweet of tweets) {
          if (!seenIds.has(tweet.sourceId)) {
            seenIds.add(tweet.sourceId);
            allTweets.push(tweet);
          }
        }

        logger.info({ count: tweets.length }, `Found ${tweets.length} tweets`);
      } catch (error) {
        const scraperErr = wrapScraperError(error, 'twitter', { query });
        errors.push(scraperErr.message);
        logger.error({ err: scraperErr }, `Error: ${scraperErr.message}`);
      }
    }

    // Also search by hashtags
    const hashtags = ['#buildinpublic', '#indiehacker', '#devtools'];
    for (const hashtag of hashtags) {
      try {
        logger.info(`Searching hashtag: ${hashtag}...`);
        queriesUsed.push(hashtag);

        const tweets = await this.searchWithFallback(hashtag, {
          maxResults: maxResultsPerQuery,
          startTime: startDate,
        });

        // Deduplicate and filter for pain points
        for (const tweet of tweets) {
          if (!seenIds.has(tweet.sourceId) && this.hasPainPointSignal(tweet)) {
            seenIds.add(tweet.sourceId);
            allTweets.push(tweet);
          }
        }

        logger.info({ count: tweets.length }, `Found ${tweets.length} relevant tweets`);
      } catch (error) {
        const scraperErr = wrapScraperError(error, 'twitter', { hashtag });
        errors.push(scraperErr.message);
        logger.error({ err: scraperErr }, `Error: ${scraperErr.message}`);
      }
    }

    const filteredTweets = this.filterAndSortTweets(allTweets);
    const duration = Date.now() - startTime;

    logger.info({ total: filteredTweets.length, durationMs: duration, errorCount: errors.length }, 'Twitter scraping complete');

    return {
      tweets: filteredTweets,
      method: methodUsed,
      totalFound: filteredTweets.length,
      errors,
      duration,
      queriesUsed,
    };
  }

  /**
   * Search with automatic fallback from API to Nitter
   */
  private async searchWithFallback(
    query: string,
    options: { maxResults?: number; startTime?: Date }
  ): Promise<Tweet[]> {
    // Try API first if available
    if (this.apiClient && this.preferredMethod !== 'nitter') {
      try {
        return await this.apiClient.searchTweets(query, options);
      } catch (error) {
        logger.warn({ err: error }, 'API search failed, trying Nitter');
      }
    }

    // Fallback to Nitter
    try {
      return await this.nitterScraper.searchTweets(query, options);
    } catch (error) {
      const scraperErr = wrapScraperError(error, 'twitter', { query, method: 'nitter' });
      logger.error({ err: scraperErr }, 'Nitter search also failed');
      return [];
    }
  }

  /**
   * Check if tweet contains pain point signals
   */
  private hasPainPointSignal(tweet: Tweet): boolean {
    if (tweet.signals.length > 0) return true;
    return hasSignals(tweet.body);
  }

  /**
   * Filter out spam/low-quality tweets and sort by relevance
   */
  private filterAndSortTweets(tweets: Tweet[]): Tweet[] {
    const sorted = tweets
      .filter(tweet => {
        if (tweet.body.length < MIN_TWEET_LENGTH) return false;

        // Filter out tweets that are mostly links/mentions
        const textOnly = tweet.body
          .replace(/https?:\/\/\S+/g, '')
          .replace(/@\w+/g, '')
          .trim();
        if (textOnly.length < MIN_CLEAN_TEXT_LENGTH) return false;

        // Filter out obvious spam patterns
        const spamPatterns = [
          /free (giveaway|airdrop|crypto)/i,
          /follow (and|&) retweet/i,
          /dm me for/i,
          /check my bio/i,
          /join (our|my) discord/i,
        ];
        if (spamPatterns.some(pattern => pattern.test(tweet.body))) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Score based on engagement and signals
        const scoreA = this.calculateRelevanceScore(a);
        const scoreB = this.calculateRelevanceScore(b);
        return scoreB - scoreA;
      });

    // Truncate to MAX_POSTS_PER_SOURCE to prevent OOM and control downstream costs
    return truncateResults(sorted);
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(tweet: Tweet): number {
    let score = 0;

    score += tweet.likes * LIKE_WEIGHT;
    score += tweet.retweets * RETWEET_WEIGHT;
    score += tweet.commentCount * COMMENT_WEIGHT;

    score += tweet.signals.length * SIGNAL_BONUS;

    // Bonus for relevant hashtags
    const relevantTags = ['buildinpublic', 'indiehacker', 'devtools', 'dev', 'coding'];
    const matchingTags = tweet.hashtags.filter(tag =>
      relevantTags.some(rt => tag.toLowerCase().includes(rt))
    );
    score += matchingTags.length * HASHTAG_BONUS;

    if (tweet.authorFollowers > FOLLOWER_THRESHOLD_MEDIUM) score += FOLLOWER_BONUS_MEDIUM;
    if (tweet.authorFollowers > FOLLOWER_THRESHOLD_HIGH) score += FOLLOWER_BONUS_HIGH;

    const hoursOld = (Date.now() - tweet.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursOld < RECENCY_HOURS_FRESH) score += RECENCY_BONUS_FRESH;
    else if (hoursOld < RECENCY_HOURS_RECENT) score += RECENCY_BONUS_RECENT;

    return score;
  }

  /**
   * Check if Twitter API is available
   */
  async isApiAvailable(): Promise<boolean> {
    if (!this.apiClient) return false;
    return await this.apiClient.healthCheck();
  }

  /**
   * Check if Nitter is available
   */
  async isNitterAvailable(): Promise<boolean> {
    const result = await this.nitterScraper.healthCheck();
    return result.healthy;
  }

  /**
   * Get status of both methods
   */
  async getStatus(): Promise<{
    api: { available: boolean; hasToken: boolean };
    nitter: { available: boolean; instance?: string };
  }> {
    const apiAvailable = await this.isApiAvailable();
    const nitterStatus = await this.nitterScraper.healthCheck();

    return {
      api: {
        available: apiAvailable,
        hasToken: this.apiClient !== null,
      },
      nitter: {
        available: nitterStatus.healthy,
        instance: nitterStatus.instance,
      },
    };
  }

  /**
   * Set preferred scraping method
   */
  setPreferredMethod(method: ScraperMethod): void {
    this.preferredMethod = method;
  }
}

/**
 * Convenience function for quick scraping
 */
export async function scrapeTwitter(
  queries: string[],
  hoursBack: number = 24
): Promise<Tweet[]> {
  const scraper = new TwitterScraper();
  return scraper.scrapeQueries(queries, hoursBack);
}

/**
 * Singleton scraper instance
 */
export const twitterScraper = new TwitterScraper();

/**
 * CLI entry point
 */
async function main() {
  logger.info('='.repeat(60));
  logger.info('ZeroToShip Twitter Scraper');
  logger.info('='.repeat(60));

  const scraper = new TwitterScraper();

  // Check status
  logger.info('Checking scraper status...');
  const status = await scraper.getStatus();
  logger.info(`Twitter API: ${status.api.available ? 'Available' : 'Not available'} (token: ${status.api.hasToken ? 'present' : 'missing'})`);
  logger.info(`Nitter: ${status.nitter.available ? `Available (${status.nitter.instance})` : 'Not available'}`);

  if (!status.api.available && !status.nitter.available) {
    logger.error('No scraping methods available!');
    logger.error('Please either: 1. Set TWITTER_BEARER_TOKEN environment variable, or 2. Ensure at least one Nitter instance is accessible');
    process.exit(1);
  }

  // Run scraper
  logger.info('Starting Twitter scrape...');

  const result = await scraper.scrapeAll(24, 50);

  logger.info({ method: result.method, total: result.totalFound, durationMs: result.duration, errors: result.errors.length }, 'Results Summary');

  result.tweets.slice(0, 10).forEach((tweet, i) => {
    logger.info({ rank: i + 1, author: tweet.author, followers: tweet.authorFollowers, likes: tweet.likes, retweets: tweet.retweets, comments: tweet.commentCount, signals: tweet.signals, url: tweet.url }, `${tweet.body.slice(0, 200)}`);
  });
}

// Run if executed directly (CommonJS check)
if (require.main === module) {
  main().catch(err => logger.error({ err }, 'Twitter scraper failed'));
}
