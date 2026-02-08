# ZeroToShip

A social signal scraper for identifying emerging startup ideas.

## Project Structure

- **Code**: `~/Projects/ideaforge/` (this directory)
- **Documentation**: `~/DevVault/01-Projects/ideaforge/`
- **Future Enhancements**: See `Feature-Plan.md` → Future Enhancements section
- **10x Analysis**: `.claude/docs/ai/ideaforge/10x/session-1.md`

---

## Session Protocol

### Start of Session
1. Read `vault/01-Projects/ideaforge/Context.md` — understand current state before doing anything
2. Check `git status` and `git log --oneline -5` — know what changed recently
3. If tests exist, run `npm test` — confirm baseline is green before making changes

### End of Session
1. Run `npm run build && npm test` — verify nothing is broken
2. Commit or stash any in-progress work — never leave a dirty working tree overnight
3. Update `vault/01-Projects/ideaforge/Context.md`:
   - "Last Updated" date
   - "Recent Changes" table
   - "Current Focus" — what to pick up next session
   - "Known Issues" if anything new was discovered
4. If corrections were made by the user, add to Common Mistakes table

---

## Verification Commands

```bash
# Full verification (ALWAYS run before marking work complete)
npm run build && npm test

# Type checking only
npx tsc --noEmit

# Cost validation
npm run validate-costs
```

---

## Common Mistakes

> **Living document**: After ANY correction from the user, add the mistake here to prevent recurrence.

| Date | Mistake | Fix |
|------|---------|-----|
| 2026-02-01 | Used OpenAI SDK instead of Anthropic | Always use `@anthropic-ai/sdk`, not `openai` |
| 2026-02-01 | Mocked wrong client in tests | Mock `Anthropic` from `@anthropic-ai/sdk` |

---

## Context.md — Keep It Updated

**Location**: `vault/01-Projects/ideaforge/Context.md`

**Rule**: After any session that modifies code, fixes bugs, or changes documentation, update Context.md:
- Update "Last Updated" date
- Add entry to "Recent Changes" table
- Update "What's Left" checklist if items were completed or added
- Update "Known Issues" if bugs were fixed or discovered
- Update "Current Focus" if the project direction shifted

This is the single source of truth for project state. If Context.md is stale, future sessions start with wrong assumptions.

**Memory note**: If MEMORY.md contradicts CLAUDE.md or Context.md, the latter two win. Update MEMORY.md to resolve the conflict.

---

## Architecture Guide

### Where Things Go
```
src/scrapers/       → Data collection from external sources
src/analysis/       → Clustering, scoring, gap analysis
src/generation/     → AI-powered brief generation
src/delivery/       → Email and notification sending
src/api/            → Fastify routes, middleware, services
src/api/db/         → Drizzle schema and database client
src/scheduler/      → Pipeline orchestration and cron
src/config/         → Shared configuration (models, env)
packages/shared/    → Types shared between backend and frontend
web/                → Next.js frontend (separate workspace)
tests/              → Mirror of src/ structure
drizzle/            → SQL migrations
scripts/            → One-off utilities (db-seed, stripe-setup)
```

### Key Conventions
- **AI calls**: Use Anthropic Claude for text generation, OpenAI for embeddings only
- **Models**: Import from `src/config/models.ts` — never hardcode model IDs
- **Validation**: Zod schemas for all API request/response types
- **Database**: Drizzle ORM, never raw SQL in application code
- **Types**: Use `@zerotoship/shared` for types that cross the frontend/backend boundary
- **Error handling**: Every AI call must have a fallback (heuristic or template data)
- **Env vars**: Access via config objects, never `process.env` directly in business logic

---

## Constraints — Things to Never Do

- **Never hardcode API keys or secrets** — all via environment variables
- **Never add a dependency without checking** if an existing one already handles it
- **Never use `any` type** — the codebase has zero `any` types, keep it that way
- **Never modify the database schema** without creating a Drizzle migration
- **Never use `console.log` in new code** — use Pino logger (migrating toward this)
- **Never skip tests** — new features need tests, bug fixes need regression tests
- **Never commit `.env`** — it's gitignored for a reason

---

## Testing Expectations

- Run `npm test` before and after changes
- New features require tests. Bug fixes require a regression test that would have caught the bug.
- Tests mock all external APIs (Anthropic, OpenAI, Stripe, Resend, SerpAPI). Never make real API calls in tests.
- Test files mirror source structure: `src/analysis/scorer.ts` → `tests/analysis/scorer.test.ts`

---

## Workflow

### Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### Subagent Strategy
- Use subagents to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

### Verification Before Done
- Never mark a task complete without proving it works
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check types, demonstrate correctness

### Autonomous Bug Fixing
- When given a bug report: investigate and fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user

### When Stuck
- Don't brute force. If an approach isn't working after 2 attempts, step back and reconsider.
- Read the actual error message. Read the actual code. Don't guess.
- If blocked by something outside your control, say so clearly and suggest alternatives.

---

## Core Principles

- **Read before write**: Never modify code you haven't read. Understand existing patterns first.
- **Simplicity first**: Make every change as simple as possible. The right abstraction is the minimum one.
- **Minimal blast radius**: Changes should only touch what's necessary. Don't refactor neighboring code.
- **No laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Prove it works**: Show evidence — test output, build output, or behavioral demonstration.
