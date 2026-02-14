# ZeroToShip

Automated SaaS that scrapes the web for technical pain points and generates prioritized entrepreneurial ideas.

## Career Demo Docs

For interview-ready project evidence, start here:

1. `reviews/career/README.md`
2. `reviews/career/impact-scoreboard.md`
3. `reviews/career/experiment-log.md`
4. `reviews/career/decision-log.md`
5. `reviews/career/weekly-build-log.md`
6. `demos/README.md`

## Current MVP Surface (2026-02-13)

This repository now runs as a monorepo with:

1. API (`src/api`)
2. Scheduler and pipeline orchestration (`src/scheduler`)
3. Web app (`web/`)

Common commands:

```bash
# API
npm run dev:api

# Scheduler
npm run scheduler:run

# Web
npm run web:dev
```

## Features

- **Reddit Scraper**: Collects posts from entrepreneurship and developer subreddits
- **Signal Detection**: Identifies pain points, frustrations, and product opportunities
- **Multiple Output Formats**: JSON, CSV, summary, and full text

## Quick Start

```bash
# Install dependencies
npm install

# Run Reddit scraper
npm run dev reddit

# Run with options
npm run dev reddit --hours 48 --format json

# Run tests
npm test
```

## Usage

### Reddit Scraper

```bash
# Default: scrape all subreddits for last 24 hours
npm run dev reddit

# Specify time range
npm run dev reddit --hours 48

# Specify subreddits
npm run dev reddit --subreddits webdev,programming,startups

# Different output formats
npm run dev reddit --format json    # JSON output
npm run dev reddit --format csv     # CSV output
npm run dev reddit --format full    # Full post details
npm run dev reddit --format summary # Summary with top 10 (default)

# Include posts without signals
npm run dev reddit --all
```

### Programmatic Usage

```typescript
import { scrapeReddit, detectSignals, getScrapeStats } from 'zerotoship';

// Scrape Reddit
const posts = await scrapeReddit(['webdev', 'programming'], 24);
console.log(`Found ${posts.length} posts with pain points`);

// Get statistics
const stats = getScrapeStats(posts);
console.log(stats.bySubreddit);

// Detect signals in any text
const signals = detectSignals('I wish there was a better tool for this');
console.log(signals); // ['i wish', 'wish there was']
```

## Default Subreddits

- r/SideProject
- r/startups
- r/Entrepreneur
- r/webdev
- r/programming
- r/devops
- r/selfhosted
- r/software

## Pain Point Signals

The scraper detects these categories of signals:

| Category | Examples |
|----------|----------|
| **Wishful** | "I wish", "wish there was", "would be nice if" |
| **Frustration** | "frustrated", "annoying", "hate when", "sick of" |
| **Seeking** | "why isn't there", "looking for a tool", "is there a way" |
| **Willingness to Pay** | "I'd pay for", "shut up and take my money" |
| **Feature Requests** | "feature request", "enhancement", "help wanted" |
| **Problems** | "the problem is", "struggling with", "doesn't work" |

## API Rate Limiting

The scraper respects Reddit's rate limits:
- 60 requests per minute maximum
- 1 second delay between requests by default
- Automatic pagination through results

## Project Structure

```
src/
  scrapers/
    reddit.ts       # Main scraper logic
    types.ts        # Shared interfaces
    signals.ts      # Pain point detection
  index.ts          # Entry point & CLI

tests/
  scrapers/
    reddit.test.ts  # Unit tests
```

## Configuration

Create a `.env` file (optional):

```env
# Use `.env.example` as the canonical reference; these are the most common knobs.

# Scheduler: run daily at 5:00 AM PST (example)
SCHEDULER_CRON=0 5 * * *
SCHEDULER_TIMEZONE=America/Los_Angeles
SCHEDULER_ENABLED=true

# Generation mode: `graph` enables the LangGraph-style generation provider.
# Scheduler can override the mode independently.
GENERATION_MODE=legacy
SCHEDULER_GENERATION_MODE=graph

# Email delivery (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
# Optional sender identity (recommended in production; must be verified in Resend)
RESEND_FROM_EMAIL=briefs@zerotoship.dev
RESEND_FROM_NAME=ZeroToShip
```

## Output Schema

```typescript
interface RawPost {
  id: string;              // UUID
  source: 'reddit';        // Source platform
  sourceId: string;        // Reddit post ID
  title: string;           // Post title
  body: string;            // Post content
  url: string;             // Direct link
  author: string;          // Reddit username
  score: number;           // Upvotes
  commentCount: number;    // Number of comments
  createdAt: Date;         // When posted
  scrapedAt: Date;         // When scraped
  subreddit: string;       // Subreddit name
  signals: string[];       // Detected pain point phrases
}
```

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build TypeScript
npm run build

# Lint
npm run lint
```

## License

MIT
