#!/bin/bash
# IdeaForge API Deployment Script (Railway)
# Usage: ./deploy-api.sh [environment]

set -e

ENVIRONMENT=${1:-production}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "🚀 Deploying IdeaForge API to Railway ($ENVIRONMENT)"
echo "================================================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install with: npm install -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Run: railway login"
    exit 1
fi

cd "$PROJECT_DIR"

# Build the project first
echo "📦 Building project..."
npm run build

# Run tests before deploying
echo "🧪 Running tests..."
npm run test:run || {
    echo "⚠️  Tests failed. Continue deployment? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
}

# Deploy to Railway
echo "🚂 Deploying to Railway..."
railway up --detach

# Get deployment URL
echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📊 Check status:"
echo "   railway status"
echo ""
echo "📋 View logs:"
echo "   railway logs"
echo ""
echo "🔗 Open dashboard:"
echo "   railway open"
echo ""

# Verify health check
echo "⏳ Waiting for deployment (30s)..."
sleep 30

RAILWAY_URL=$(railway domain 2>/dev/null || echo "")
if [[ -n "$RAILWAY_URL" ]]; then
    echo "🏥 Checking health..."
    curl -s "https://$RAILWAY_URL/health" | jq . || echo "Health check pending..."
fi

echo ""
echo "🎉 Deployment complete!"
