import { Octokit } from '@octokit/rest';
import { RateLimitInfo } from './types';
import { config } from '../config/env';
import logger from '../lib/logger';

/**
 * GitHub API wrapper using Octokit
 * Handles authentication, rate limiting, and pagination
 */
export class GitHubAPI {
  private octokit: Octokit;
  private rateLimitRemaining: number = 5000;
  private rateLimitResetAt: Date = new Date();

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || config.GITHUB_TOKEN,
      userAgent: 'ZeroToShip/1.0',
    });
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    const { data } = await this.octokit.rateLimit.get();
    this.rateLimitRemaining = data.resources.search.remaining;
    this.rateLimitResetAt = new Date(data.resources.search.reset * 1000);
    
    return {
      remaining: this.rateLimitRemaining,
      limit: data.resources.search.limit,
      resetAt: this.rateLimitResetAt,
    };
  }

  /**
   * Update rate limit from response headers
   */
  private updateRateLimitFromHeaders(headers: Record<string, unknown>): void {
    if (headers['x-ratelimit-remaining']) {
      this.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining'] as string, 10);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimitResetAt = new Date(parseInt(headers['x-ratelimit-reset'] as string, 10) * 1000);
    }
  }

  /**
   * Wait if rate limit is low
   */
  private async waitIfNeeded(): Promise<void> {
    if (this.rateLimitRemaining < 5) {
      const waitMs = Math.max(0, this.rateLimitResetAt.getTime() - Date.now());
      if (waitMs > 0) {
        logger.info({ waitSeconds: Math.ceil(waitMs / 1000) }, 'Rate limit low, waiting');
        await new Promise(resolve => setTimeout(resolve, waitMs + 1000));
      }
    }
  }

  /**
   * Search issues with a GitHub search query
   */
  async searchIssues(query: string, options: {
    perPage?: number;
    maxPages?: number;
    sort?: 'reactions' | 'comments' | 'created' | 'updated';
    order?: 'asc' | 'desc';
  } = {}): Promise<{
    items: GitHubSearchIssueItem[];
    totalCount: number;
    rateLimitRemaining: number;
  }> {
    const { perPage = 100, maxPages = 3, sort = 'reactions', order = 'desc' } = options;
    const allItems: GitHubSearchIssueItem[] = [];
    let totalCount = 0;

    for (let page = 1; page <= maxPages; page++) {
      await this.waitIfNeeded();

      try {
        const response = await this.octokit.search.issuesAndPullRequests({
          q: query,
          per_page: perPage,
          page,
          sort,
          order,
        });

        this.updateRateLimitFromHeaders(response.headers as Record<string, unknown>);
        totalCount = response.data.total_count;

        const items = response.data.items.map(item => this.transformIssueItem(item as unknown as SearchIssueItem));
        allItems.push(...items);

        if (allItems.length >= totalCount || response.data.items.length < perPage) {
          break;
        }
      } catch (error) {
        if (this.isRateLimitError(error)) {
          logger.warn('Rate limit exceeded, stopping pagination');
          break;
        }
        throw error;
      }
    }

    return {
      items: allItems,
      totalCount,
      rateLimitRemaining: this.rateLimitRemaining,
    };
  }

  /**
   * Get repository info including star count
   */
  async getRepoInfo(owner: string, repo: string): Promise<{
    stars: number;
    fullName: string;
    description: string | null;
  }> {
    await this.waitIfNeeded();
    
    const { data, headers } = await this.octokit.repos.get({ owner, repo });
    this.updateRateLimitFromHeaders(headers as Record<string, unknown>);
    
    return {
      stars: data.stargazers_count,
      fullName: data.full_name,
      description: data.description,
    };
  }

  /**
   * Transform raw API issue item to our format
   */
  private transformIssueItem(item: SearchIssueItem): GitHubSearchIssueItem {
    return {
      id: item.id,
      number: item.number,
      title: item.title,
      body: item.body || '',
      htmlUrl: item.html_url,
      state: item.state as 'open' | 'closed',
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      user: item.user?.login || 'unknown',
      labels: item.labels.map(label => 
        typeof label === 'string' ? label : label.name || ''
      ).filter(Boolean),
      comments: item.comments,
      reactions: item.reactions?.total_count || 0,
      repoFullName: this.extractRepoFromUrl(item.html_url),
    };
  }

  /**
   * Extract owner/repo from issue URL
   */
  private extractRepoFromUrl(url: string): string {
    const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
    return match ? match[1] : '';
  }

  /**
   * Check if error is rate limit related
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as { status: number }).status === 403;
    }
    return false;
  }

  /**
   * Validate the configured token by calling the rate limit endpoint
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getRateLimit();
      return true;
    } catch {
      return false;
    }
  }

  get currentRateLimitRemaining(): number {
    return this.rateLimitRemaining;
  }
}

interface SearchIssueItem {
  id: number;
  number: number;
  title: string;
  body: string | null | undefined;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  user: { login: string } | null;
  labels: Array<string | { name?: string }>;
  comments: number;
  reactions?: { total_count: number };
}

export interface GitHubSearchIssueItem {
  id: number;
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  state: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  user: string;
  labels: string[];
  comments: number;
  reactions: number;
  repoFullName: string;
}
