# IdeaForge

Automated SaaS that scrapes the web for technical pain points and generates prioritized entrepreneurial ideas.

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
import { scrapeReddit, detectSignals, getScrapeStats } from 'ideaforge';

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
# Custom user agent (recommended)
REDDIT_USER_AGENT=MyApp/1.0

# Request delay in ms (default: 1000)
REQUEST_DELAY=1000
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
