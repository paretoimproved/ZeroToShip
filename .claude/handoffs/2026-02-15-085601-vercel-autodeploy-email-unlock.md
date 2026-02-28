# Handoff: Vercel Auto-Deploy Re-Enabled + Email Brief Unlock Fix (ZeroToShip / IdeaForge)

- Date: 2026-02-15
- Repo (local): `/Users/brandonqueener/Desktop/github/Projects/IdeaForge`
- GitHub repo: `paretoimproved/ZeroToShip`
- Local state warning: the repo root is currently on a dirty branch (`codex/dummy-proof-ux`). For production-safe work, use the clean worktree:
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/.worktrees/main`

## Why This Handoff Exists

Enable a fresh agent in Claude Code to quickly understand:

1. The user-facing fix for daily email click-through (free users seeing locked/TBD content).
2. The current deployment posture (Vercel + GitHub Actions) after upgrading to Vercel Pro.
3. Where the LangGraph migration architecture and phase roadmap are documented (and how to retrieve it).

This handoff is meant to be used alongside:

- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/.claude/handoffs/2026-02-15-083739-openclaw-demo-langgraph.md`

## Canonical LangGraph Architecture Docs (5-Phase Migration)

These are the authoritative sources for the LangGraph migration (phases, decisions, and status):

- Roadmap status: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-roadmap-status.md`
- Decision log: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-decision-log.md`
- Session handoff log: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-session-handoff.md`
- Implementation plan: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-implementation-plan.md`
- Architecture evolution diagrams: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-architecture-evolution.md`

Note: `docs/` is gitignored in this repo (stored locally / DevVault). For Claude Code on this machine, these absolute paths are still readable.

## What Was Fixed (User Bug Report)

Symptom:
- Clicking daily email brief links sometimes landed on idea detail pages showing placeholder values ("TBD") and "analysis locked".

Root cause:
- Email links were often opened in a browser session without auth.
- The backend returns `IdeaSummary` without `brief` for anonymous tier; the UI then had placeholder-mapping behavior that looked broken/locked.

Fix strategy (small + reversible):
1. Ensure free-tier email click-through ends up authenticated.
2. Ensure authenticated free users always see a flat `IdeaBrief` in the web client.
3. Make email subject lines less long/cheesy.

## Code Changes (Email + Web)

### Email: route free-tier idea links through login

For free-tier emails, idea URLs now point to:
- `/login?next=/idea/<id>`

So recipients who open the email while logged out still land on a fully unlocked brief after login.

File:
- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/src/delivery/email-builder.ts`

### Web: protect idea detail + unwrap brief response

- `/idea/[id]` is protected via `ProtectedLayout`, which redirects to `/login?next=...` when logged out.
- `api.getIdea()` unwraps `IdeaSummary.brief` so idea detail pages consistently receive a flat `IdeaBrief`.

Files:
- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/web/app/idea/[id]/page.tsx`
- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/web/lib/api.ts`

### Email subject: shorter + more factual

File:
- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/src/delivery/email-builder.ts`

## PRs / Evidence (GitHub)

Merged PRs:

- Email unlock + shorter subject + protect idea detail:
  - https://github.com/paretoimproved/ZeroToShip/pull/4
- Free-tier email links route through login:
  - https://github.com/paretoimproved/ZeroToShip/pull/5
- Re-enabled Vercel auto-deploy on pushes to `main`:
  - https://github.com/paretoimproved/ZeroToShip/pull/7

## Deploy State (Vercel + GitHub Actions)

The user upgraded to Vercel Pro; deploy quota issues from the free tier should no longer block deploys.

Latest successful push-based deploy evidence:
- GitHub Actions run: https://github.com/paretoimproved/ZeroToShip/actions/runs/22020943225
- Vercel inspect: https://vercel.com/ideaforge-ddad2823/web/256PfVno4gHbrEX12nnPstkNC9Cn
- Vercel production deployment URL: https://web-78rxmprm9-ideaforge-ddad2823.vercel.app
- Alias: https://www.zerotoship.dev

CI workflow file (for reference):
- Canonical (clean worktree): `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/.worktrees/main/.github/workflows/ci.yml`
- Repo root may be stale (dirty branch): `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/.github/workflows/ci.yml`

## How To Verify The Fix (Manual QA)

Goal: daily brief’s top 3 ideas for free users should be fully unlocked and match the Today tab for that user.

1. Open a daily email idea link in an incognito/logged-out browser.
2. Confirm you land on `/login?next=/idea/<uuid>`.
3. Log in as a free user.
4. Confirm:
   - the idea detail page shows full brief content (no "TBD" placeholders)
   - it is not "analysis locked"
   - the idea content matches what appears under the Today tab for that user
5. Confirm email subject is shorter and non-cheezy.

## Obsidian / Daily Logs (Optional Context)

- DevVault path: `/Users/brandonqueener/Desktop/github/DevVault`
- Relevant day: `/Users/brandonqueener/Desktop/github/DevVault/01-Projects/main/Daily/2026-02-14.md`

These logs are narrative only; the canonical architecture is in the planning docs listed above.

## Secrets / Safety

- Do not paste API keys, tokens, or provider credentials into handoffs or repo files.
- GitHub Actions uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets.

## Exact Next Steps (For Claude Code)

1. Start in the clean worktree:
   - `cd /Users/brandonqueener/Desktop/github/Projects/IdeaForge/.worktrees/main`
2. Verify web behavior locally (optional):
   - `npm run web:dev`
3. Verify production click-through behavior from a real email:
   - Open the email in incognito and confirm the `/login?next=/idea/<id>` flow works end-to-end.
