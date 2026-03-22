# Session Context

Session ID: 4f9952f7-1572-4e88-8088-3915d1c75e4f
Commit Message: Base directory for this skill: /Users/brandonqueener/.claude/plugins/cac

## Prompts

### Prompt 1

build

### Prompt 2

Base directory for this skill: /Users/brandonqueener/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/skills/executing-plans

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Superpowers works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use superpowers:subagent-driven-development instead of this skill.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks

## Summary

All 4 tasks complete. Here's the summary:

**Step 1: Free tier spec + pricing DRY** (5 files changed, 1 new)
- `src/api/config/tiers.ts` — `SPEC_GENERATION_LIMITS.free: 0 → 1`, `FEATURE_ACCESS.ideas.generateSpec.minTier: 'pro' → 'free'`
- `web/components/GenerateSpecCta.tsx` — tier-aware State 2b (free users see upgrade CTA)
- `web/lib/plans.ts` — new shared pricing data (DRY extraction)
- `web/components/landing/PricingSection.tsx` — uses shared plans data
- `web/app/pricing/PricingPageContent.tsx` — uses shared plans data
- `tests/api/tiers.test.ts` — updated assertions

**Step 2: Public idea pages** (3 files changed/new)
- `web/app/idea/[id]/page.tsx` — server component, LandingNav + Footer, public
- `web/components/IdeaSpecSection.tsx` — client wrapper for auth + spec logic
- `web/app/idea/[id]/loading.tsx` — skeleton loading state

**Step 3: Spec showcase** (3 files changed/new)
- `web/app/explore/specs/[slug]/page.tsx` — showcase with provenance, CTA, SEO
- `web/app/explore/specs/[slug]/SpecShowcaseClient.tsx` — clipboard wrapper
- `web/app/sitemap.ts` — added `/explore/specs/shipwatch`

**Verification:** Build clean, type check clean, 1,410 tests pass (55 files).

Ready when you are — run `/ship` to create the PR, or let me know if you want to review any of the changes first.
