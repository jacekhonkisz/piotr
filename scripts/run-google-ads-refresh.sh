#!/bin/bash

# Google Ads Data Refresh Runner
# This script will drop ALL existing Google Ads data and re-fetch from API

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  GOOGLE ADS DATA REFRESH TOOL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will:"
echo "  1. ✅ Backup existing data"
echo "  2. 🗑️  Delete ALL Google Ads summaries"
echo "  3. 🔄 Re-fetch data from Google Ads API"
echo "  4. 💾 Store fresh data for all clients"
echo ""
echo "Options:"
echo "  --dry-run      Test mode (no changes)"
echo "  --skip-backup  Skip backup step"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running in dry-run mode
if [[ "$*" == *"--dry-run"* ]]; then
    echo "🧪 Running in DRY RUN mode..."
    echo ""
elif [[ "$*" == *"--yes"* ]] || [[ "$*" == *"-y"* ]]; then
    echo "⚠️  WARNING: This will DELETE and REPLACE all historical Google Ads data!"
    echo "✅ Auto-confirmed via --yes flag"
    echo ""
else
    echo "⚠️  WARNING: This will DELETE and REPLACE all historical Google Ads data!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "❌ Aborted by user"
        exit 1
    fi
    echo ""
fi

# Navigate to project root
cd "$(dirname "$0")/.." || exit 1

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found!"
    echo "   Please create .env.local with required credentials"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Check for required env vars
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Missing required environment variables!"
    echo "   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "✅ Environment loaded"
echo ""

# Run the TypeScript script
echo "🚀 Starting data refresh..."
echo ""

npx tsx scripts/refresh-all-google-ads-data.ts "$@"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ DATA REFRESH COMPLETED SUCCESSFULLY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ DATA REFRESH FAILED (exit code: $exit_code)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
fi

exit $exit_code

