# Session Context

Session ID: ac7ff410-8aa6-46b4-a2cb-aed44954d1ec
Commit Message: Yes, Sounds like a good plan. What do you recommend for Railway

## Prompts

### Prompt 1

Yes, Sounds like a good plan. What do you recommend for Railway?

## Summary

OK, here's the full picture and what you need to do manually. Let me summarize:

---

## What I've done

### 1. Slimmed CI + added gated deploys (`.github/workflows/ci.yml`)

Three jobs now:
- **`test`** — Runs `npm run test:run` (not watch mode), `web:test`, and `build`. Dropped redundant `tsc --noEmit`.
- **`deploy-vercel`** — Runs only after `test` passes, only on push to main. Uses your existing `VERCEL_TOKEN` secret.
- **`deploy-railway`** — Runs only after `test` passes, only on push to main, **and only if backend files changed** (src/, packages/, Dockerfile, etc). Skips on frontend-only pushes.

### 2. Post-push verification hook (`scripts/verify-deploy.sh`)

Added a `PostToolUse` hook on `Bash(git push*)` that:
- Finds the CI run for the just-pushed commit
- Polls every 10s (up to 3 min) until complete
- Reports pass/fail and deploy status back into the conversation

### 3. What you need to do manually

**A. Disable Vercel auto-deploy from Git:**
1. Go to [Vercel Dashboard](https://vercel.com) → **web** project → **Settings** → **Git**
2. Under **"Deploy Hooks"** or **"Connected Git Repository"**, look for **"Ignored Build Step"**
3. Set it to: **`exit 0`** — this tells Vercel to skip auto-builds from Git pushes (CI handles deploys now)

Alternatively, you can simply disconnect Git from Vercel: `vercel git disconnect` — but then you lose PR preview deploys. The "Ignored Build Step = exit 0" approach is cleaner.

**B. Disable Railway auto-deploy:**
1. Go to [Railway Dashboard](https://railway.app) → **ideaforge** project → **scheduler** service → **Settings**
2. Under **"Deploy"** → **"Source"**, disable **"Auto Deploy"** (toggle it off)

**C. Create a Railway token and add it to GitHub:**
1. Go to [Railway Dashboard](https://railway.app) → **Account Settings** → **Tokens**
2. Create a new token (name it `github-actions`)
3. Add it as a GitHub secret:
   ```
   gh secret set RAILWAY_TOKEN
   ```
   Then paste the token when prompted.

Want me to wait while you do those three steps, then we can test the whole flow with a push?
