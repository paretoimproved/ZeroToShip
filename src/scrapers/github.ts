import { GitHubAPI, GitHubSearchIssueItem } from './github-api';
import { GitHubIssue, GitHubSearchQuery, ScrapeResult } from './types';
import { detectSignals } from './signals';
import logger from '../lib/logger';

/**
 * Default search queries for finding unmet needs in GitHub issues
 */
export const DEFAULT_GITHUB_QUERIES: GitHubSearchQuery[] = [
  {
    query: 'label:"help wanted" is:open is:issue stars:>500',
    description: 'Open issues with help wanted label in popular repos',
  },
  {
    query: 'label:"feature request" is:open is:issue reactions:>10',
    description: 'Popular feature requests with high engagement',
  },
  {
    query: 'label:enhancement is:open is:issue reactions:>5 stars:>500',
    description: 'Enhancement requests in popular repos',
  },
  {
    query: '"would be nice if" in:body is:issue is:open',
    description: 'Issues expressing wishes for features',
  },
  {
    query: '"wish this had" in:body is:issue is:open',
    description: 'Issues wishing for missing features',
  },
];

/**
 * Cache for repository star counts to reduce API calls
 */
const repoStarsCache = new Map<string, number>();

/**
 * Main GitHub scraper class
 */
export class GitHubScraper {
  private api: GitHubAPI;
  private queries: GitHubSearchQuery[];

  constructor(token?: string, queries?: GitHubSearchQuery[]) {
    this.api = new GitHubAPI(token);
    this.queries = queries || DEFAULT_GITHUB_QUERIES;
  }

  /**
   * Scrape GitHub for issues matching configured queries
   */
  async scrape(options: {
    hoursBack?: number;
    maxPerQuery?: number;
    minStars?: number;
  } = {}): Promise<ScrapeResult<GitHubIssue>> {
    const { hoursBack = 168, maxPerQuery = 50, minStars = 100 } = options;
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    const allIssues: GitHubIssue[] = [];
    const seenIds = new Set<number>();
    let totalFound = 0;
    let rateLimitRemaining = 5000;

    logger.info({ queryCount: this.queries.length }, 'Starting GitHub scrape');

    for (const queryConfig of this.queries) {
      try {
        const dateFilter = ' created:>' + cutoffDate.toISOString().split('T')[0];
        const fullQuery = queryConfig.query + dateFilter;
        
        logger.info({ description: queryConfig.description }, 'Searching');
        
        const result = await this.api.searchIssues(fullQuery, {
          perPage: 100,
          maxPages: Math.ceil(maxPerQuery / 100),
          sort: 'reactions',
          order: 'desc',
        });

        totalFound += result.totalCount;
        rateLimitRemaining = result.rateLimitRemaining;

        for (const item of result.items) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          const repoStars = await this.getRepoStars(item.repoFullName);
          if (repoStars < minStars) continue;

          const issue = this.transformToGitHubIssue(item, repoStars);
          allIssues.push(issue);

          if (allIssues.length >= maxPerQuery * this.queries.length) break;
        }

        if (rateLimitRemaining < 10) {
          logger.warn('Rate limit running low, stopping early');
          break;
        }
      } catch (error) {
        logger.error({ err: error, description: queryConfig.description }, 'Error with query');
      }
    }

    const sortedIssues = allIssues.sort((a, b) => {
      const scoreA = a.reactions + a.commentCount + (a.repoStars / 1000);
      const scoreB = b.reactions + b.commentCount + (b.repoStars / 1000);
      return scoreB - scoreA;
    });

    logger.info({ unique: sortedIssues.length, total: totalFound }, 'GitHub scrape complete');

    return {
      posts: sortedIssues,
      totalFound,
      scrapedAt: new Date(),
      queryUsed: this.queries.map(q => q.query).join(' | '),
      rateLimitRemaining,
    };
  }

  /**
   * Get star count for a repository (cached)
   */
  private async getRepoStars(repoFullName: string): Promise<number> {
    if (repoStarsCache.has(repoFullName)) {
      return repoStarsCache.get(repoFullName)!;
    }

    try {
      const [owner, repo] = repoFullName.split('/');
      if (!owner || !repo) return 0;

      const repoInfo = await this.api.getRepoInfo(owner, repo);
      repoStarsCache.set(repoFullName, repoInfo.stars);
      return repoInfo.stars;
    } catch {
      repoStarsCache.set(repoFullName, 0);
      return 0;
    }
  }

  /**
   * Transform API item to GitHubIssue format
   */
  private transformToGitHubIssue(item: GitHubSearchIssueItem, repoStars: number): GitHubIssue {
    const fullText = item.title + ' ' + item.body;
    
    return {
      id: 'github-' + item.id,
      source: 'github',
      sourceId: String(item.id),
      title: item.title,
      body: item.body,
      url: item.htmlUrl,
      author: item.user,
      score: item.reactions + item.comments,
      commentCount: item.comments,
      createdAt: item.createdAt,
      scrapedAt: new Date(),
      signals: detectSignals(fullText),
      repo: item.repoFullName,
      repoStars,
      reactions: item.reactions,
      labels: item.labels,
      state: item.state,
    };
  }

  /**
   * Add a custom search query
   */
  addQuery(query: GitHubSearchQuery): void {
    this.queries.push(query);
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit() {
    return this.api.getRateLimit();
  }
}

/**
 * Convenience function to scrape GitHub with default settings
 */
export async function scrapeGitHub(
  queries?: string[],
  hoursBack: number = 168
): Promise<GitHubIssue[]> {
  const customQueries = queries?.map(q => ({
    query: q,
    description: 'Custom query',
  }));

  const scraper = new GitHubScraper(undefined, customQueries);
  const result = await scraper.scrape({ hoursBack });
  return result.posts;
}

export { GitHubAPI } from './github-api';
export * from './types';
