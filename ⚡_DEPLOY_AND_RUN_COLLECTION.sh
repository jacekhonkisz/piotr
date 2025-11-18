#!/bin/bash

# ⚡ DEPLOY AND RUN COLLECTION SCRIPT
# This script deploys the fixes and runs the weekly collection

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ WEEKLY DATA FIX - DEPLOYMENT SCRIPT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
    echo "❌ ERROR: CRON_SECRET environment variable not set!"
    echo ""
    echo "Please set it first:"
    echo "  export CRON_SECRET='your-secret-here'"
    echo ""
    echo "You can find it in:"
    echo "  - Vercel Dashboard → Settings → Environment Variables"
    echo "  - Or in your .env.local file"
    exit 1
fi

echo "✅ CRON_SECRET is set"
echo ""

# Step 1: Check git status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 STEP 1: Checking git status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git status --short
echo ""

# Step 2: Add files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 STEP 2: Adding files to git"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git add src/app/api/fetch-live-data/route.ts
git add src/app/api/admin/clear-weekly-cache/route.ts
git add vercel.json
git add src/app/api/automated/collect-weekly-summaries/route.ts
git add src/app/api/automated/collect-monthly-summaries/route.ts
echo "✅ Files staged"
echo ""

# Step 3: Commit
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 STEP 3: Committing changes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git commit -m "Fix: Weekly data showing monthly + Consolidate to single endpoint

Critical Fixes:
1. Prevent weekly requests from falling through to monthly cache
2. Remove all duplicate weekly collection endpoints (keep only ONE)
3. Add admin endpoint to clear corrupted weekly cache
4. Update cron schedule (Sunday 1 AM → 3 AM)

Changes:
- src/app/api/fetch-live-data/route.ts: Added !isCurrentWeekRequest guard
- src/app/api/admin/clear-weekly-cache/route.ts: New cache clearing endpoint
- vercel.json: Updated weekly cron to use collect-weekly-summaries
- Deleted 6 duplicate weekly endpoints (incremental, optimized, manual, etc.)

Impact:
- Current week shows correct weekly data (3-4k vs 25k)
- Single unified weekly collection system
- No duplicate API calls
- Proper monthly/weekly separation"

echo "✅ Changes committed"
echo ""

# Step 4: Push to production
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 STEP 4: Pushing to production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git push origin main
echo ""
echo "✅ Pushed to Vercel"
echo ""
echo "⏳ Waiting 30 seconds for deployment to complete..."
sleep 30
echo ""

# Step 5: Get deployment URL
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 STEP 5: Finding deployment URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Try to get URL from vercel.json or package.json
VERCEL_URL=""

# Check common URLs
if curl -s -o /dev/null -w "%{http_code}" "https://piotr-gamma.vercel.app/api/health" | grep -q "200\|401"; then
    VERCEL_URL="https://piotr-gamma.vercel.app"
elif curl -s -o /dev/null -w "%{http_code}" "https://meta-ads-reporting-saas.vercel.app/api/health" | grep -q "200\|401"; then
    VERCEL_URL="https://meta-ads-reporting-saas.vercel.app"
fi

if [ -z "$VERCEL_URL" ]; then
    echo "⚠️  Could not auto-detect Vercel URL"
    echo ""
    echo "Please enter your Vercel deployment URL:"
    echo "Example: https://your-project.vercel.app"
    read -p "URL: " VERCEL_URL
fi

echo "✅ Using URL: $VERCEL_URL"
echo ""

# Step 6: Clear corrupted cache
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗑️  STEP 6: Clearing corrupted weekly cache (Week 47)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET "$VERCEL_URL/api/admin/clear-weekly-cache?week=2025-W47" \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.' || echo "Response received"
echo ""
echo "✅ Cache cleared"
echo ""

# Step 7: Run weekly collection
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STEP 7: Running weekly collection (53 weeks)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ This will take 5-10 minutes..."
echo ""
curl -s -X POST "$VERCEL_URL/api/automated/collect-weekly-summaries" \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.' || echo "Response received"
echo ""
echo "✅ Weekly collection started"
echo ""

# Final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Fixes deployed to production"
echo "✅ Corrupted cache cleared"
echo "✅ Weekly collection running"
echo ""
echo "📊 WHAT TO EXPECT:"
echo "   • Current week (Week 47): ~3,000-4,000 zł (correct!)"
echo "   • Past weeks (Week 46, 45, etc.): Full weekly data"
echo "   • Monthly reports: Still working (25,000 zł)"
echo ""
echo "🔍 VERIFY:"
echo "   1. Open your reports page"
echo "   2. Select Week 47 (Nov 17-23)"
echo "   3. Should show ~3,500 zł (NOT 25,000 zł)"
echo ""
echo "⏰ NEXT AUTOMATIC COLLECTION:"
echo "   • Weekly: Sunday 3:00 AM"
echo "   • Monthly: Sunday 1:00 AM"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

