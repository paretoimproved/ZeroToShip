#!/usr/bin/env bash
# verify-deploy.sh — Check CI, Railway, and Vercel after a push to main.
# Run manually: ./scripts/verify-deploy.sh
# Or via Claude Code PostToolUse hook after `git push`.

set -euo pipefail

MAX_WAIT=300  # 5 minutes max
POLL_INTERVAL=10
API_URL="https://ideaforge-production-ad68.up.railway.app/api/v1"
WEB_URL="https://zerotoship.dev"

COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

echo "═══════════════════════════════════════════════"
echo "  Deploy Verification: ${COMMIT:0:7} on $BRANCH"
echo "═══════════════════════════════════════════════"

# ── Step 1: Wait for CI ──────────────────────────────────
echo ""
echo "Step 1/3: CI"

for i in $(seq 1 10); do
  RUN_ID=$(gh run list --commit "$COMMIT" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")
  [ -n "$RUN_ID" ] && break
  sleep 3
done

if [ -z "$RUN_ID" ]; then
  echo "  ⚠ No CI run found — skipping"
else
  echo "  Run: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/runs/$RUN_ID"

  ELAPSED=0
  while [ $ELAPSED -lt $MAX_WAIT ]; do
    CONCLUSION=$(gh run view "$RUN_ID" --json status,conclusion --jq '.conclusion // ""' 2>/dev/null || echo "")
    RUN_STATUS=$(gh run view "$RUN_ID" --json status --jq '.status' 2>/dev/null || echo "")

    if [ "$RUN_STATUS" = "completed" ]; then
      if [ "$CONCLUSION" = "success" ]; then
        echo "  ✓ CI passed"
        break
      else
        echo "  ✗ CI failed ($CONCLUSION)"
        gh run view "$RUN_ID" --json jobs --jq '.jobs[] | select(.conclusion == "failure") | "    Failed: \(.name)"' 2>/dev/null || true
        exit 1
      fi
    fi

    ELAPSED=$((ELAPSED + POLL_INTERVAL))
    printf "  ⏳ CI running... (%ds)\r" "$ELAPSED"
    sleep $POLL_INTERVAL
  done

  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "  ⚠ CI still running after ${MAX_WAIT}s"
  fi
fi

# ── Step 2: Railway deploy ───────────────────────────────
echo ""
echo "Step 2/3: Railway"

if command -v railway &>/dev/null; then
  # Poll Railway deployment status
  ELAPSED=0
  RAILWAY_OK=false
  while [ $ELAPSED -lt $MAX_WAIT ]; do
    LATEST=$(railway deployment list 2>/dev/null | head -2 | tail -1 || echo "")
    STATUS=$(echo "$LATEST" | awk '{print $3}')

    case "$STATUS" in
      SUCCESS)
        echo "  ✓ Railway deployed"
        RAILWAY_OK=true
        break
        ;;
      FAILED|CRASHED)
        echo "  ✗ Railway deploy failed ($STATUS)"
        echo "    Check: https://railway.app"
        exit 1
        ;;
      *)
        ELAPSED=$((ELAPSED + POLL_INTERVAL))
        printf "  ⏳ Railway: %s (%ds)\r" "$STATUS" "$ELAPSED"
        sleep $POLL_INTERVAL
        ;;
    esac
  done

  if [ "$RAILWAY_OK" = true ]; then
    # Health check the API
    sleep 5
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/ideas/archive?pageSize=1" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      echo "  ✓ API health check passed ($API_URL)"
    else
      echo "  ⚠ API health check returned $HTTP_CODE"
    fi
  fi
else
  echo "  ⚠ Railway CLI not installed — skipping"
fi

# ── Step 3: Vercel / Frontend ────────────────────────────
echo ""
echo "Step 3/3: Vercel"

sleep 10
HTTP_CODE=$(curl -sfL -o /dev/null -w "%{http_code}" "$WEB_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ Frontend live ($WEB_URL)"
else
  echo "  ⚠ Frontend returned $HTTP_CODE"
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Deploy verification complete for ${COMMIT:0:7}"
echo "═══════════════════════════════════════════════"
