/**
 * Nitter Scraper - Fallback for Twitter/X when API is unavailable
 *
 * Nitter is an open-source, privacy-focused Twitter frontend.
 * This scraper extracts tweets from Nitter instances without requiring API keys.
 *
 * Note: Nitter instances may be unreliable or rate-limited.
 * Use as fallback when Twitter API is unavailable.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { Tweet, TwitterConfig, PAIN_POINT_SIGNALS } from './types.js';

/**
 * Default Nitter instances to try (in order of preference)
 */
const DEFAULT_NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.cz',
  'https://nitter.1d4.us',
];

/**
 * Nitter scraper class
 */
export class NitterScraper {
  private instances: string[];
  private currentInstanceIndex: number = 0;
  private rateLimitDelay: number;
  private lastRequestTime: number = 0;

  constructor(config: TwitterConfig = {}) {
    this.instances = config.nitterInstances ?? DEFAULT_NITTER_INSTANCES;
    this.rateLimitDelay = config.rateLimitDelay ?? 3000; // 3 seconds between requests
  }

  /**
   * Get the current Nitter instance URL
   */
  private get currentInstance(): string {
    return this.instances[this.currentInstanceIndex];
  }

  /**
   * Switch to the next Nitter instance
   */
  private switchInstance(): boolean {
    this.currentInstanceIndex++;
    if (this.currentInstanceIndex >= this.instances.length) {
      this.currentInstanceIndex = 0;
      return false; // Wrapped around, all instances tried
    }
    return true;
  }

  /**
   * Search for tweets using Nitter
   */
  async searchTweets(
    query: string,
    options: {
      maxResults?: number;
      startTime?: Date;
    } = {}
  ): Promise<Tweet[]> {
    const maxResults = options.maxResults ?? 50;
    let attempts = 0;
    const maxAttempts = this.instances.length;

    while (attempts < maxAttempts) {
      try {
        await this.rateLimit();

        const encodedQuery = encodeURIComponent(query);
        const url = `${this.currentInstance}/search?f=tweets&q=${encodedQuery}`;

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        });

        if (!response.ok) {
          console.warn(`Nitter instance ${this.currentInstance} returned ${response.status}`);
          if (this.switchInstance()) {
            attempts++;
            continue;
          }
          throw new Error(`All Nitter instances failed`);
        }

        const html = await response.text();
        const tweets = this.parseTweetsFromHtml(html, maxResults);

        // Filter by start time if specified
        if (options.startTime) {
          const filtered = tweets.filter(t => t.createdAt >= options.startTime!);
          return filtered;
        }

        return tweets;
      } catch (error) {
        console.warn(`Error with Nitter instance ${this.currentInstance}:`, error);
        if (this.switchInstance()) {
          attempts++;
          continue;
        }
        throw error;
      }
    }

    throw new Error('All Nitter instances failed');
  }

  /**
   * Search for tweets by hashtag
   */
  async searchByHashtag(hashtag: string, maxResults: number = 50): Promise<Tweet[]> {
    const tag = hashtag.startsWith('#') ? hashtag.slice(1) : hashtag;
    return this.searchTweets(`#${tag}`, { maxResults });
  }

  /**
   * Parse tweets from Nitter HTML response
   */
  private parseTweetsFromHtml(html: string, maxResults: number): Tweet[] {
    const $ = cheerio.load(html);
    const tweets: Tweet[] = [];

    $('.timeline-item').each((_, element) => {
      if (tweets.length >= maxResults) return false;

      const $item = $(element);

      // Skip retweets
      if ($item.find('.retweet-header').length > 0) {
        return;
      }

      // Skip pinned tweets
      if ($item.find('.pinned').length > 0) {
        return;
      }

      try {
        const tweet = this.parseTweetElement($, $item);
        if (tweet) {
          tweets.push(tweet);
        }
      } catch (error) {
        console.warn('Error parsing tweet element:', error);
      }
    });

    return tweets;
  }

  /**
   * Parse a single tweet element
   */
  private parseTweetElement(
    $: cheerio.CheerioAPI,
    $item: cheerio.Cheerio<Element>
  ): Tweet | null {
    // Extract tweet link to get ID
    const tweetLink = $item.find('.tweet-link').attr('href');
    if (!tweetLink) return null;

    const tweetIdMatch = tweetLink.match(/status\/(\d+)/);
    if (!tweetIdMatch) return null;

    const tweetId = tweetIdMatch[1];

    // Extract author
    const authorLink = $item.find('.username').first().text().trim();
    const author = authorLink.replace('@', '');

    // Extract tweet text
    const tweetContent = $item.find('.tweet-content').first();
    const body = tweetContent.text().trim();

    if (!body) return null;

    // Extract metrics
    const stats = $item.find('.tweet-stat');
    let likes = 0;
    let retweets = 0;
    let replies = 0;

    stats.each((_, stat) => {
      const $stat = $(stat);
      const iconClass = $stat.find('.icon-container').attr('class') ?? '';
      const valueText = $stat.text().trim();
      const value = this.parseMetricValue(valueText);

      if (iconClass.includes('heart') || iconClass.includes('like')) {
        likes = value;
      } else if (iconClass.includes('retweet')) {
        retweets = value;
      } else if (iconClass.includes('comment') || iconClass.includes('reply')) {
        replies = value;
      }
    });

    // Extract timestamp
    const timestampAttr = $item.find('.tweet-date a').attr('title');
    const createdAt = timestampAttr ? new Date(timestampAttr) : new Date();

    // Extract hashtags
    const hashtags: string[] = [];
    tweetContent.find('a[href^="/search?q=%23"]').each((_, el) => {
      const tag = $(el).text().replace('#', '');
      if (tag) hashtags.push(tag);
    });

    // Detect pain point signals
    const textLower = body.toLowerCase();
    const signals = PAIN_POINT_SIGNALS.filter(signal =>
      textLower.includes(signal.toLowerCase())
    );

    return {
      id: `twitter_${tweetId}`,
      source: 'twitter',
      sourceId: tweetId,
      title: '',
      body,
      url: `https://twitter.com/${author}/status/${tweetId}`,
      author,
      score: likes + retweets,
      commentCount: replies,
      createdAt,
      scrapedAt: new Date(),
      signals,
      likes,
      retweets,
      authorFollowers: 0, // Not available from Nitter search results
      hashtags,
      isReply: body.startsWith('@'),
      conversationId: undefined,
    };
  }

  /**
   * Parse metric values like "1.2K", "500", etc.
   */
  private parseMetricValue(text: string): number {
    const cleaned = text.replace(/[^0-9.KkMm]/g, '').trim();
    if (!cleaned) return 0;

    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;

    if (cleaned.toLowerCase().includes('k')) {
      return Math.round(num * 1000);
    }
    if (cleaned.toLowerCase().includes('m')) {
      return Math.round(num * 1000000);
    }

    return Math.round(num);
  }

  /**
   * Enforce rate limiting between requests
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Check if any Nitter instance is accessible
   */
  async healthCheck(): Promise<{ healthy: boolean; instance?: string }> {
    for (const instance of this.instances) {
      try {
        const response = await fetch(instance, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (response.ok) {
          return { healthy: true, instance };
        }
      } catch {
        continue;
      }
    }

    return { healthy: false };
  }

  /**
   * Get list of available Nitter instances
   */
  getInstances(): string[] {
    return [...this.instances];
  }
}

/**
 * Factory function to create Nitter scraper
 */
export function createNitterScraper(instances?: string[]): NitterScraper {
  const configInstances = instances ?? process.env.NITTER_INSTANCES?.split(',');
  return new NitterScraper({
    nitterInstances: configInstances,
  });
}
