# Session Context

Session ID: e6ad986b-c8f7-49a6-85da-348dc9ef88fc
Commit Message: Why did the emails stop scheduling after 2/28

## Prompts

### Prompt 1

Why did the emails stop scheduling after 2/28?

## Summary

Build passes. Here's the summary:

---

**Root cause**: PG advisory lock + connection pool mismatch.

- `REDIS_URL` is not configured, so the pipeline lock falls back to `pg_try_advisory_lock`
- Production DB client uses a pool of 10 connections (`src/api/db/client.ts:27`)
- `acquire` on connection A, `release` on connection B → release silently fails → lock is permanently stuck
- Every subsequent cron run gets "lock held by another run" and silently skips

**Fix** (3 files):

| File | Change |
|------|--------|
| `src/lib/pipeline-lock.ts` | Replaced pooled `db.execute()` with a dedicated single-connection `postgres` client for advisory lock ops. Acquire and release now always hit the same DB session. Added `closeLockClient()` for shutdown. |
| `src/scheduler/cli.ts` | Added `closeLockClient()` to SIGINT/SIGTERM handlers for clean shutdown |
| `tests/lib/pipeline-lock.test.ts` | Updated mocks for the new `postgres` import, added tests for PG fallback lock acquired/held states |

**Immediate action needed**: After deploying this fix, the currently-stuck advisory lock will be released when Railway restarts the scheduler container (new process = new connections = old locks freed). Emails should resume on the next cron trigger at 6 AM ET.
