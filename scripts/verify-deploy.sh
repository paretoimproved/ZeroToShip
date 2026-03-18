#!/usr/bin/env bash
# verify-deploy.sh — Check CI status and deploy result after a push.
# Called by Claude Code PostToolUse hook after `git push`.
# Outputs JSON for Claude Code to parse and report back.

set -euo pipefail

# Only run if the last command was a git push
# (hook passes tool input via stdin, but we check context via args)

MAX_WAIT=180  # 3 minutes max
POLL_INTERVAL=10

# Get the latest CI run for the current commit
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

echo "Watching CI for commit ${COMMIT:0:7} on $BRANCH..."

# Wait for the run to appear
for i in $(seq 1 5); do
  RUN_ID=$(gh run list --commit "$COMMIT" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 3
done

if [ -z "$RUN_ID" ]; then
  echo "⚠ No CI run found for commit ${COMMIT:0:7}"
  exit 0
fi

echo "CI run: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/runs/$RUN_ID"

# Poll until complete
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(gh run view "$RUN_ID" --json status,conclusion --jq '{status: .status, conclusion: .conclusion}' 2>/dev/null || echo '{"status":"unknown"}')

  RUN_STATUS=$(echo "$STATUS" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  CONCLUSION=$(echo "$STATUS" | grep -o '"conclusion":"[^"]*"' | cut -d'"' -f4)

  if [ "$RUN_STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      echo "✓ CI passed — deploys will follow"

      # Check Vercel deployment
      sleep 5
      VERCEL_URL=$(vercel ls --meta gitCommitSha="$COMMIT" --token="${VERCEL_TOKEN:-}" 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "")
      if [ -n "$VERCEL_URL" ]; then
        echo "✓ Vercel: $VERCEL_URL"
      fi

      echo "✓ Deploy pipeline complete"
      exit 0
    else
      echo "✗ CI failed ($CONCLUSION)"
      echo "  Fix the issue and push again. No deploys were triggered."
      gh run view "$RUN_ID" --json jobs --jq '.jobs[] | select(.conclusion == "failure") | "  Failed: \(.name)"' 2>/dev/null || true
      exit 1
    fi
  fi

  ELAPSED=$((ELAPSED + POLL_INTERVAL))
  printf "  ⏳ CI running... (%ds)\r" "$ELAPSED"
  sleep $POLL_INTERVAL
done

echo "⚠ CI still running after ${MAX_WAIT}s — check manually:"
echo "  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/runs/$RUN_ID"
exit 0
