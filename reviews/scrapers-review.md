# Code Review: Scrapers Module

**Reviewed**: 2026-01-31
**Reviewer**: Code Review Agent
**Files Reviewed**:
- `src/scrapers/types.ts`
- `src/scrapers/signals.ts`
- `src/scrapers/reddit.ts`
- `src/scrapers/hackernews.ts`
- `src/scrapers/hn-api.ts`
- `src/scrapers/twitter.ts`
- `src/scrapers/twitter-api.ts`
- `src/scrapers/twitter-nitter.ts`
- `src/scrapers/github.ts`
- `src/scrapers/github-api.ts`

---

## TypeScript Quality

- [x] No `any` types - all interfaces properly typed
- [x] Interfaces match documentation (RawPost, Tweet, GitHubIssue, HNPost)
- [x] Proper error types used throughout
- [x] Generic types used appropriately (ScrapeResult<T extends RawPost>)

**Notes**: TypeScript usage is excellent. All interfaces are well-defined with proper source discriminants.

---

## Code Style

- [x] Consistent naming conventions (camelCase functions, PascalCase types)
- [x] Proper JSDoc comments on exported functions
- [ ] **ISSUE**: Uses `console.log`/`console.error` for logging instead of proper logging library

**Notes**:
- Functions follow consistent naming: `scrapeReddit()`, `scrapeHackerNews()`, etc.
- Each scraper has good JSDoc with examples
- Should consider using a logging library (pino, winston) for production

---

## Architecture

- [x] Follows existing patterns - all scrapers export similar APIs
- [x] Correct imports from other modules
- [x] Exports match interface documentation
- [x] Good separation of concerns (API clients vs scraper logic)

**Notes**:
- Clean separation between API wrappers (`github-api.ts`, `hn-api.ts`, `twitter-api.ts`) and scrapers
- Twitter has excellent fallback pattern (API → Nitter)
- Each scraper normalizes output to `RawPost` interface

---

## Error Handling

- [x] All async functions have try/catch
- [x] Errors are properly typed
- [x] Graceful degradation (continues on per-subreddit/query errors)

**Notes**:
- Rate limit errors are detected and handled appropriately
- Timeout handling implemented in Reddit scraper
- Twitter scraper has multi-instance fallback

---

## Security

- [x] No secrets in code
- [x] API keys loaded from environment variables
- [x] User-Agent headers properly set (Reddit requirement)
- [ ] Input validation present but could be more explicit

**Notes**:
- GitHub token from `process.env.GITHUB_TOKEN`
- Twitter token from `process.env.TWITTER_BEARER_TOKEN`
- No hardcoded API keys or credentials

---

## Performance

- [x] No N+1 query patterns
- [x] Proper caching where needed (GitHub repo stars cache)
- [x] Efficient data structures (Set for deduplication)
- [x] Rate limiting implemented (Reddit: 1s, Twitter: 2s, Nitter: 3s)

**Notes**:
- GitHub uses star count cache to minimize API calls
- HN uses Algolia API (efficient)
- Deduplication by sourceId prevents duplicates

---

## Issues Found

### 1. Code Duplication - **Severity: Medium**

`detectSignals()` function is duplicated:
- `types.ts:139-144` - basic implementation
- `signals.ts:118-131` - more complete implementation
- `hackernews.ts:111-117` - local reimplementation

**Recommendation**: Remove duplicates, use single source from `signals.ts`

### 2. Duplicate Pain Point Constants - **Severity: Medium**

Pain point signals defined in two places:
- `types.ts`: `PAIN_POINT_SIGNALS` (34 patterns)
- `signals.ts`: `SIGNAL_PATTERNS` (50+ patterns by category)

**Recommendation**: Consolidate into `signals.ts` only

### 3. Console Logging - **Severity: Low**

All scrapers use `console.log`/`console.warn`/`console.error`:
- `reddit.ts:278, 283, 288, 294, 299`
- `hackernews.ts:178, 238, 313, 342-345`
- `twitter.ts:120, 125, 141, 145, 169, 180-183`
- `github.ts:63, 70, 96, 100, 110`

**Recommendation**: Replace with structured logging (pino recommended)

### 4. Import Position - **Severity: Low**

In `hackernews.ts`, the `PAIN_POINT_SIGNALS` is imported from `types.ts` but a local `detectSignals` is defined anyway.

**Recommendation**: Import from `signals.ts` consistently

---

## Recommendations

### High Priority
1. **Consolidate signal detection** - Single source of truth in `signals.ts`
2. **Remove duplicate constants** - Use `SIGNAL_PATTERNS` from `signals.ts` everywhere

### Medium Priority
3. **Add structured logging** - Replace console.* with pino or similar
4. **Add retry logic to Reddit** - Currently only HN API has retry

### Low Priority
5. **Add request metrics** - Track API calls, cache hits, rate limits
6. **Consider connection pooling** - For high-volume scraping

---

## Summary

The scrapers module is **well-architected** with good separation between API clients and business logic. TypeScript usage is excellent with no `any` types. Main issues are code duplication and use of console logging.

**Overall Quality**: 8/10

**Ready for Production**: Yes, with logging improvements
