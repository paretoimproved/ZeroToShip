/**
 * Twitter API v2 Client for IdeaForge
 *
 * Uses the official Twitter API v2 to search for developer pain points.
 * Requires a Twitter Developer account with at least Basic tier access.
 *
 * Rate limits (Basic tier): 450 requests per 15-minute window
 * @see https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent
 */

import { Tweet, TwitterConfig, PAIN_POINT_SIGNALS } from './types';
import logger from '../lib/logger';

const TWITTER_API_BASE = 'https://api.twitter.com/2';

/**
 * Twitter API v2 response types
 */
interface TwitterApiTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  conversation_id?: string;
  entities?: {
    hashtags?: Array<{ tag: string }>;
    mentions?: Array<{ username: string }>;
  };
}

interface TwitterApiUser {
  id: string;
  username: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface TwitterSearchResponse {
  data?: TwitterApiTweet[];
  includes?: {
    users?: TwitterApiUser[];
  };
  meta: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
}

/**
 * Default search queries for finding developer pain points
 */
export const DEFAULT_TWITTER_QUERIES = [
  { query: '"wish there was an app" -is:retweet', description: 'App wishlists' },
  { query: '"frustrated with" (developer OR coding OR programming) -is:retweet', description: 'Developer frustrations' },
  { query: '"I\'d pay for" (tool OR app OR service) -is:retweet', description: 'Willingness to pay' },
  { query: '"why is there no" (app OR tool) -is:retweet', description: 'Market gaps' },
  { query: '#buildinpublic (struggling OR frustrating OR annoying) -is:retweet', description: 'Build in public struggles' },
  { query: '#indiehacker "wish" -is:retweet', description: 'Indie hacker wishes' },
  { query: '#devtools (broken OR sucks OR hate) -is:retweet', description: 'Dev tools complaints' },
  { query: '"need a tool" (developer OR dev OR coding) -is:retweet', description: 'Tool requests' },
];

/**
 * Twitter API v2 client
 */
export class TwitterApiClient {
  private bearerToken: string;
  private rateLimitDelay: number;
  private lastRequestTime: number = 0;

  constructor(config: TwitterConfig) {
    if (!config.bearerToken) {
      throw new Error('Twitter bearer token is required. Get one from https://developer.twitter.com/');
    }
    this.bearerToken = config.bearerToken;
    this.rateLimitDelay = config.rateLimitDelay ?? 2000; // 2 seconds between requests
  }

  /**
   * Search recent tweets using Twitter API v2
   */
  async searchTweets(
    query: string,
    options: {
      maxResults?: number;
      startTime?: Date;
    } = {}
  ): Promise<Tweet[]> {
    const maxResults = Math.min(options.maxResults ?? 100, 100); // API max is 100 per request

    await this.rateLimit();

    const params = new URLSearchParams({
      query,
      max_results: maxResults.toString(),
      'tweet.fields': 'created_at,public_metrics,conversation_id,entities,author_id',
      'user.fields': 'public_metrics,username',
      expansions: 'author_id',
    });

    if (options.startTime) {
      params.set('start_time', options.startTime.toISOString());
    }

    const url = `${TWITTER_API_BASE}/tweets/search/recent?${params}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429) {
        throw new Error(`Twitter API rate limit exceeded. Try again later.`);
      }
      if (response.status === 401) {
        throw new Error('Twitter API authentication failed. Check your bearer token.');
      }
      throw new Error(`Twitter API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as TwitterSearchResponse;

    if (!data.data || data.data.length === 0) {
      return [];
    }

    // Create user map for efficient lookup
    const userMap = new Map<string, TwitterApiUser>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user);
      }
    }

    return data.data.map(tweet => this.transformTweet(tweet, userMap));
  }

  /**
   * Search with pagination for more results
   */
  async searchTweetsPaginated(
    query: string,
    options: {
      totalResults?: number;
      startTime?: Date;
    } = {}
  ): Promise<Tweet[]> {
    const totalResults = options.totalResults ?? 100;
    const allTweets: Tweet[] = [];
    let nextToken: string | undefined;

    while (allTweets.length < totalResults) {
      await this.rateLimit();

      const params = new URLSearchParams({
        query,
        max_results: '100',
        'tweet.fields': 'created_at,public_metrics,conversation_id,entities,author_id',
        'user.fields': 'public_metrics,username',
        expansions: 'author_id',
      });

      if (options.startTime) {
        params.set('start_time', options.startTime.toISOString());
      }

      if (nextToken) {
        params.set('next_token', nextToken);
      }

      const url = `${TWITTER_API_BASE}/tweets/search/recent?${params}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('Rate limit hit, stopping pagination');
          break;
        }
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = (await response.json()) as TwitterSearchResponse;

      if (!data.data || data.data.length === 0) {
        break;
      }

      const userMap = new Map<string, TwitterApiUser>();
      if (data.includes?.users) {
        for (const user of data.includes.users) {
          userMap.set(user.id, user);
        }
      }

      const tweets = data.data.map(tweet => this.transformTweet(tweet, userMap));
      allTweets.push(...tweets);

      nextToken = data.meta.next_token;
      if (!nextToken) {
        break;
      }
    }

    return allTweets.slice(0, totalResults);
  }

  /**
   * Transform Twitter API response to our Tweet interface
   */
  private transformTweet(
    apiTweet: TwitterApiTweet,
    userMap: Map<string, TwitterApiUser>
  ): Tweet {
    const user = userMap.get(apiTweet.author_id);
    const hashtags = apiTweet.entities?.hashtags?.map(h => h.tag) ?? [];

    // Detect pain point signals in tweet text
    const textLower = apiTweet.text.toLowerCase();
    const signals = PAIN_POINT_SIGNALS.filter(signal =>
      textLower.includes(signal.toLowerCase())
    );

    return {
      id: `twitter_${apiTweet.id}`,
      source: 'twitter',
      sourceId: apiTweet.id,
      title: '', // Tweets don't have titles
      body: apiTweet.text,
      url: `https://twitter.com/${user?.username ?? 'i'}/status/${apiTweet.id}`,
      author: user?.username ?? 'unknown',
      score: apiTweet.public_metrics.like_count + apiTweet.public_metrics.retweet_count,
      commentCount: apiTweet.public_metrics.reply_count,
      createdAt: new Date(apiTweet.created_at),
      scrapedAt: new Date(),
      signals,
      likes: apiTweet.public_metrics.like_count,
      retweets: apiTweet.public_metrics.retweet_count,
      authorFollowers: user?.public_metrics.followers_count ?? 0,
      hashtags,
      isReply: apiTweet.text.startsWith('@'),
      conversationId: apiTweet.conversation_id,
    };
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
   * Check if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.searchTweets('test', { maxResults: 10 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Factory function to create Twitter API client
 */
export function createTwitterApiClient(bearerToken?: string): TwitterApiClient | null {
  const token = bearerToken ?? process.env.TWITTER_BEARER_TOKEN;

  if (!token) {
    logger.warn('No Twitter bearer token found. Set TWITTER_BEARER_TOKEN environment variable.');
    return null;
  }

  return new TwitterApiClient({ bearerToken: token });
}
