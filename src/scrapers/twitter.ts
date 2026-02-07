/**
 * Twitter/X Scraper for IdeaForge
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
import { Tweet, TwitterConfig, TwitterSearchQuery, PAIN_POINT_SIGNALS } from './types';
import { TwitterApiClient, createTwitterApiClient, DEFAULT_TWITTER_QUERIES } from './twitter-api';
import { NitterScraper, createNitterScraper } from './twitter-nitter';
import logger from '../lib/logger';

// Load environment variables
config();

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
    const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
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
        logger.error({ err: error, query }, `Error searching for "${query}"`);
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
    const startDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Query "${description}": ${errorMsg}`);
        logger.error(`Error: ${errorMsg}`);
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Hashtag "${hashtag}": ${errorMsg}`);
        logger.error(`Error: ${errorMsg}`);
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
      logger.error({ err: error }, 'Nitter search also failed');
      return [];
    }
  }

  /**
   * Check if tweet contains pain point signals
   */
  private hasPainPointSignal(tweet: Tweet): boolean {
    if (tweet.signals.length > 0) return true;

    const textLower = tweet.body.toLowerCase();
    return PAIN_POINT_SIGNALS.some(signal =>
      textLower.includes(signal.toLowerCase())
    );
  }

  /**
   * Filter out spam/low-quality tweets and sort by relevance
   */
  private filterAndSortTweets(tweets: Tweet[]): Tweet[] {
    return tweets
      .filter(tweet => {
        // Filter out very short tweets
        if (tweet.body.length < 30) return false;

        // Filter out tweets that are mostly links/mentions
        const textOnly = tweet.body
          .replace(/https?:\/\/\S+/g, '')
          .replace(/@\w+/g, '')
          .trim();
        if (textOnly.length < 20) return false;

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
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(tweet: Tweet): number {
    let score = 0;

    // Base engagement score
    score += tweet.likes * 2;
    score += tweet.retweets * 3;
    score += tweet.commentCount * 5;

    // Bonus for pain point signals
    score += tweet.signals.length * 20;

    // Bonus for relevant hashtags
    const relevantTags = ['buildinpublic', 'indiehacker', 'devtools', 'dev', 'coding'];
    const matchingTags = tweet.hashtags.filter(tag =>
      relevantTags.some(rt => tag.toLowerCase().includes(rt))
    );
    score += matchingTags.length * 10;

    // Bonus for author with more followers (indicates credibility)
    if (tweet.authorFollowers > 1000) score += 10;
    if (tweet.authorFollowers > 10000) score += 20;

    // Recency bonus (tweets from last 6 hours get boost)
    const hoursOld = (Date.now() - tweet.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursOld < 6) score += 15;
    else if (hoursOld < 12) score += 10;

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
  logger.info('IdeaForge Twitter Scraper');
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
