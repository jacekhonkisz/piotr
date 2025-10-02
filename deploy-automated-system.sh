#!/bin/bash

# ============================================================================
# DEPLOY AUTOMATED MONTHLY DATA COLLECTION SYSTEM
# ============================================================================
# This script will:
# 1. Fix current data issues (NULL platforms)
# 2. Test the new endpoint
# 3. Deploy to production
# ============================================================================

echo "🚀 Deploying Automated Monthly Data Collection System"
echo ""
echo "This will ensure every client gets monthly data automatically!"
echo ""

# Step 1: Fix NULL platforms
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 1: Fix NULL Platforms in Database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  MANUAL ACTION REQUIRED:"
echo ""
echo "Run this in Supabase SQL Editor:"
echo ""
echo "UPDATE campaign_summaries"
echo "SET platform = 'meta'"
echo "WHERE platform IS NULL;"
echo ""
read -p "✅ Done? Press Enter to continue..." 

# Step 2: Test the endpoint
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Step 2: Test New Endpoint (Dry Run)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Testing endpoint for September 2025..."
echo ""

curl -s -X POST http://localhost:3000/api/automated/end-of-month-collection \
  -H "Content-Type: application/json" \
  -d '{"targetMonth": "2025-09", "dryRun": true}' | jq '{
    mode: .mode,
    targetMonth: .targetMonth,
    summary: .summary,
    sample_result: .results[0]
  }'

echo ""
read -p "✅ Looks good? Press Enter to continue..." 

# Step 3: Test with actual save (August)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Step 3: Test Live Save (August 2025)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will actually fetch and save data for August..."
echo ""

read -p "Continue with live test? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Skipped live test"
else
    curl -s -X POST http://localhost:3000/api/automated/end-of-month-collection \
      -H "Content-Type: application/json" \
      -d '{"targetMonth": "2025-08", "dryRun": false}' | jq '{
        mode: .mode,
        targetMonth: .targetMonth,
        summary: .summary,
        duration: .duration,
        successful_clients: [.results[] | select(.status == "success") | {name: .clientName, campaigns: .metrics.campaigns, spend: .metrics.spend}]
      }'
    
    echo ""
    echo "✅ August data saved!"
fi

# Step 4: Deploy to production
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 4: Deploy to Production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Ready to deploy to Vercel?"
echo ""
echo "This will:"
echo "  • Deploy the new endpoint"
echo "  • Activate the cron job (runs 1st of month at 2 AM)"
echo "  • Start automatic monthly collection"
echo ""

read -p "Deploy now? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo "❌ Deployment skipped"
    echo ""
    echo "When ready, run:"
    echo "  git add ."
    echo "  git commit -m 'feat: Add automated monthly data collection'"
    echo "  git push"
    echo ""
    exit 0
fi

echo ""
echo "🔄 Committing changes..."
git add .
git commit -m "feat: Add automated end-of-month data collection system

- New endpoint: /api/automated/end-of-month-collection
- Fetches rich campaign data from Meta API
- Quality validation (skips if has campaigns)
- Platform separation (Meta/Google)
- Runs automatically on 1st of month at 2 AM
- Processes all clients automatically
- Error recovery per client"

echo ""
echo "📤 Pushing to production..."
git push

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Your automated system is now live!"
echo ""
echo "What happens next:"
echo "  • Vercel will deploy your changes"
echo "  • Cron job will be activated automatically"
echo "  • On November 1st at 2:00 AM, it will:"
echo "    └─ Fetch October data for all clients"
echo "    └─ Save rich campaign details"
echo "    └─ Continue every month automatically"
echo ""
echo "📊 Verify deployment:"
echo "  1. Check Vercel dashboard → Cron Jobs"
echo "  2. View logs in Vercel"
echo "  3. Test manually: POST /api/automated/end-of-month-collection"
echo ""
echo "🔍 Monitor data health:"
echo "  • Check Supabase → campaign_summaries table"
echo "  • Verify all clients have data each month"
echo "  • Check /reports page for complete campaigns"
echo ""
echo "Done! 🚀"

