#!/bin/bash
# IdeaForge Web Dashboard Deployment Script (Vercel)
# Usage: ./deploy-web.sh [--prod]

set -e

PROD_FLAG=""
if [[ "$1" == "--prod" ]]; then
    PROD_FLAG="--prod"
fi

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/ideaforge-web"

# Check if web directory exists
if [[ ! -d "$WEB_DIR" ]]; then
    echo "❌ ideaforge-web directory not found at: $WEB_DIR"
    exit 1
fi

echo "🚀 Deploying IdeaForge Web Dashboard to Vercel"
echo "=============================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install with: npm install -g vercel"
    exit 1
fi

cd "$WEB_DIR"

# Check if linked to a Vercel project
if [[ ! -d ".vercel" ]]; then
    echo "⚠️  Project not linked to Vercel. Running: vercel link"
    vercel link
fi

# Build locally first to catch errors
echo "📦 Building project locally..."
npm run build

# Run linting
echo "🔍 Running linter..."
npm run lint || {
    echo "⚠️  Lint warnings detected. Continue? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
}

# Deploy
echo "☁️  Deploying to Vercel..."
if [[ -n "$PROD_FLAG" ]]; then
    vercel --prod
else
    vercel
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Check deployment status:"
echo "   vercel ls"
echo ""
echo "🔗 Open project dashboard:"
echo "   vercel inspect"
