/**
 * ZeroToShip - Entry Point
 *
 * Automated SaaS that scrapes the web for technical pain points
 * and generates prioritized entrepreneurial ideas.
 */

import 'dotenv/config';
import {
  scrapeReddit,
  scrapeAllDefaults,
  DEFAULT_SUBREDDITS,
  getScrapeStats,
  sortBySignalStrength,
} from './scrapers/reddit';
import type { RawPost } from './scrapers/types';

// Re-export everything for library usage
export * from './scrapers/reddit';
export * from './scrapers/signals';
// Export types (PAIN_POINT_SIGNALS is now exported from signals.ts via the wildcard re-export above)
export type { RawPost, HNPost, Tweet, GitHubIssue, TwitterConfig, GitHubSearchQuery, TwitterSearchQuery, RateLimitInfo, ScrapeResult } from './scrapers/types';

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'reddit':
      await runRedditScraper(args.slice(1));
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.log('ZeroToShip - Pain Point Discovery Engine\n');
      console.log('Usage: npm run dev <command> [options]\n');
      console.log('Commands:');
      console.log('  reddit     Scrape Reddit for pain points');
      console.log('  help       Show this help message\n');
      console.log('Run "npm run dev help" for more information.');
  }
}

/**
 * Run the Reddit scraper with CLI options
 */
async function runRedditScraper(args: string[]): Promise<void> {
  // Parse options
  const hoursBack = parseInt(getArg(args, '--hours', '-h') || '24', 10);
  const subredditsArg = getArg(args, '--subreddits', '-s');
  const outputFormat = getArg(args, '--format', '-f') || 'summary';
  const signalsOnly = !args.includes('--all');

  const subreddits = subredditsArg
    ? subredditsArg.split(',').map((s) => s.trim())
    : [...DEFAULT_SUBREDDITS];

  console.log('='.repeat(60));
  console.log('  ZEROTOSHIP REDDIT SCRAPER');
  console.log('='.repeat(60));
  console.log(`\nConfiguration:`);
  console.log(`  Subreddits: ${subreddits.join(', ')}`);
  console.log(`  Hours back: ${hoursBack}`);
  console.log(`  Signals only: ${signalsOnly}`);
  console.log(`  Output format: ${outputFormat}\n`);

  try {
    const posts = await scrapeReddit(subreddits, hoursBack, { signalsOnly });

    if (posts.length === 0) {
      console.log('\nNo posts with pain point signals found.');
      return;
    }

    // Sort by signal strength
    const sorted = sortBySignalStrength(posts);

    switch (outputFormat) {
      case 'json':
        console.log(JSON.stringify(sorted, null, 2));
        break;

      case 'csv':
        printCsv(sorted);
        break;

      case 'full':
        printFullOutput(sorted);
        break;

      case 'summary':
      default:
        printSummary(sorted);
        break;
    }
  } catch (error) {
    console.error('Error running Reddit scraper:', error);
    process.exit(1);
  }
}

/**
 * Print summary output
 */
function printSummary(posts: RawPost[]): void {
  const stats = getScrapeStats(posts);

  console.log('\n' + '='.repeat(60));
  console.log('  SCRAPE RESULTS SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nTotal posts found: ${stats.totalPosts}`);
  console.log(`Average score: ${stats.avgScore.toFixed(1)}`);
  console.log(`Average comments: ${stats.avgComments.toFixed(1)}`);

  console.log('\nPosts by subreddit:');
  for (const [sub, count] of Object.entries(stats.bySubreddit).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  r/${sub}: ${count}`);
  }

  console.log('\nTop signal patterns detected:');
  const sortedSignals = Object.entries(stats.bySignal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [signal, count] of sortedSignals) {
    console.log(`  "${signal}": ${count}`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('  TOP 10 POSTS (by signal strength)');
  console.log('-'.repeat(60));

  for (const post of posts.slice(0, 10)) {
    console.log(`\n[${post.score} pts | ${post.commentCount} comments] r/${post.subreddit}`);
    console.log(`  ${post.title.slice(0, 80)}${post.title.length > 80 ? '...' : ''}`);
    console.log(`  Signals: ${post.signals.join(', ')}`);
    console.log(`  URL: ${post.url}`);
  }
}

/**
 * Print full output for all posts
 */
function printFullOutput(posts: RawPost[]): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ALL ${posts.length} POSTS`);
  console.log('='.repeat(60));

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`\n--- Post ${i + 1}/${posts.length} ---`);
    console.log(`Title: ${post.title}`);
    console.log(`Subreddit: r/${post.subreddit}`);
    console.log(`Score: ${post.score} | Comments: ${post.commentCount}`);
    console.log(`Author: u/${post.author}`);
    console.log(`Created: ${post.createdAt.toISOString()}`);
    console.log(`URL: ${post.url}`);
    console.log(`Signals: ${post.signals.join(', ')}`);
    if (post.body) {
      console.log(`\nBody:\n${post.body.slice(0, 500)}${post.body.length > 500 ? '...' : ''}`);
    }
  }
}

/**
 * Print CSV output
 */
function printCsv(posts: RawPost[]): void {
  console.log('id,source_id,subreddit,title,score,comments,signals,url,created_at');

  for (const post of posts) {
    const title = post.title.replace(/"/g, '""');
    const signals = post.signals.join(';');
    console.log(
      `"${post.id}","${post.sourceId}","${post.subreddit}","${title}",${post.score},${post.commentCount},"${signals}","${post.url}","${post.createdAt.toISOString()}"`
    );
  }
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
ZeroToShip - Pain Point Discovery Engine

USAGE:
  npm run dev <command> [options]

COMMANDS:
  reddit      Scrape Reddit for pain points
  help        Show this help message

REDDIT OPTIONS:
  --hours, -h <number>       How many hours back to scrape (default: 24)
  --subreddits, -s <list>    Comma-separated list of subreddits
  --format, -f <format>      Output format: summary, full, json, csv
  --all                      Include posts without signals

EXAMPLES:
  npm run dev reddit
    Scrape default subreddits for the last 24 hours

  npm run dev reddit --hours 48
    Scrape the last 48 hours

  npm run dev reddit -s webdev,programming -h 12
    Scrape specific subreddits for the last 12 hours

  npm run dev reddit --format json > results.json
    Export results as JSON

DEFAULT SUBREDDITS:
  ${DEFAULT_SUBREDDITS.join(', ')}
`);
}

/**
 * Get argument value from CLI args
 */
function getArg(
  args: string[],
  longFlag: string,
  shortFlag?: string
): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === longFlag || (shortFlag && args[i] === shortFlag)) {
      return args[i + 1];
    }
    if (args[i].startsWith(`${longFlag}=`)) {
      return args[i].split('=')[1];
    }
  }
  return undefined;
}

// Run if executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
