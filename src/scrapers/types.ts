/**
 * Base interface for raw posts scraped from any source
 */
export interface RawPost {
  id: string;
  source: 'reddit' | 'hn' | 'twitter' | 'github';
  sourceId: string;
  title: string;
  body: string;
  url: string;
  author: string;
  score: number;
  commentCount: number;
  createdAt: Date;
  scrapedAt: Date;
  signals: string[];
  subreddit?: string;
}

/**
 * GitHub-specific issue/discussion data
 */
export interface GitHubIssue extends RawPost {
  source: 'github';
  repo: string;
  repoStars: number;
  reactions: number;
  labels: string[];
  state: 'open' | 'closed';
}

/**
 * Twitter/X specific post type
 */
export interface Tweet extends RawPost {
  source: 'twitter';
  likes: number;
  retweets: number;
  authorFollowers: number;
  hashtags: string[];
  isReply: boolean;
  conversationId?: string;
}

/**
 * Hacker News specific post type
 */
export interface HNPost extends RawPost {
  source: 'hn';
  hnType: 'story' | 'comment';
  parentId?: string;
  storyTitle?: string;
}

/**
 * Twitter API configuration
 */
export interface TwitterConfig {
  bearerToken?: string;
  nitterInstances?: string[];
  maxResults?: number;
  rateLimitDelay?: number;
}

/**
 * Search query configuration for GitHub scraper
 */
export interface GitHubSearchQuery {
  query: string;
  description: string;
}

/**
 * Search query configuration for Twitter scraper
 */
export interface TwitterSearchQuery {
  query: string;
  description: string;
}

/**
 * Rate limit info from GitHub API
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Scraper result with metadata
 */
export interface ScrapeResult<T extends RawPost> {
  posts: T[];
  totalFound: number;
  scrapedAt: Date;
  queryUsed: string;
  rateLimitRemaining: number;
}
