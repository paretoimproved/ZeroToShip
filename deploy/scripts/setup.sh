#!/bin/bash
# IdeaForge Deployment Setup Script
# Run this once to set up both Vercel and Railway projects

set -e

echo "🛠️  IdeaForge Deployment Setup"
echo "=============================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="$(cd "$PROJECT_DIR/../ideaforge-web" 2>/dev/null && pwd)" || WEB_DIR=""

# Check prerequisites
echo "📋 Checking prerequisites..."

check_command() {
    if command -v "$1" &> /dev/null; then
        echo "  ✅ $1 installed"
        return 0
    else
        echo "  ❌ $1 not found"
        return 1
    fi
}

MISSING=0
check_command "node" || MISSING=1
check_command "npm" || MISSING=1
check_command "vercel" || MISSING=1
check_command "railway" || MISSING=1
check_command "gh" || echo "  ⚠️  gh (GitHub CLI) optional but recommended"

if [[ $MISSING -eq 1 ]]; then
    echo ""
    echo "Install missing tools:"
    echo "  npm install -g vercel @railway/cli"
    exit 1
fi

echo ""
echo "🔐 Checking authentication..."

# Check Vercel auth
if vercel whoami &> /dev/null; then
    echo "  ✅ Vercel: $(vercel whoami)"
else
    echo "  ❌ Vercel: Not logged in"
    echo "     Run: vercel login"
fi

# Check Railway auth
if railway whoami &> /dev/null; then
    echo "  ✅ Railway: logged in"
else
    echo "  ❌ Railway: Not logged in"
    echo "     Run: railway login"
fi

echo ""
echo "📦 Setting up API project (Railway)..."
cd "$PROJECT_DIR"

if [[ ! -f "railway.toml" ]]; then
    echo "  Creating railway.toml..."
    cp deploy/railway.json ./railway.json 2>/dev/null || true
fi

echo "  Run 'railway init' in $PROJECT_DIR to create Railway project"

echo ""
echo "🌐 Setting up Web project (Vercel)..."
if [[ -n "$WEB_DIR" ]]; then
    cd "$WEB_DIR"
    if [[ ! -d ".vercel" ]]; then
        echo "  Run 'vercel link' in $WEB_DIR to connect to Vercel"
    else
        echo "  ✅ Already linked to Vercel"
    fi
else
    echo "  ⚠️  ideaforge-web directory not found"
fi

echo ""
echo "📋 Required Environment Variables"
echo "=================================="
echo ""
echo "Railway (API + Scheduler):"
echo "  NODE_ENV=production"
echo "  DATABASE_URL=<supabase-connection-string>"
echo "  SUPABASE_URL=<supabase-project-url>"
echo "  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>"
echo "  OPENAI_API_KEY=<openai-api-key>"
echo "  RESEND_API_KEY=<resend-api-key>"
echo "  CORS_ORIGIN=https://ideaforge.app"
echo ""
echo "Vercel (Web Dashboard):"
echo "  NEXT_PUBLIC_API_URL=https://api.ideaforge.app"
echo "  NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>"
echo ""
echo "✅ Setup guide complete!"
echo ""
echo "Next steps:"
echo "  1. Set up Railway: cd $PROJECT_DIR && railway init"
echo "  2. Set up Vercel: cd $WEB_DIR && vercel link"
echo "  3. Configure environment variables in each dashboard"
echo "  4. Deploy: ./deploy/scripts/deploy-api.sh && ./deploy/scripts/deploy-web.sh"
