#!/bin/bash

# ============================================================================
# FIX AUGUST DATA - Quick Script
# ============================================================================
# This will re-fetch August data from Meta API to replace poor quality data
# ============================================================================

echo "🔧 Fixing August and September data for all clients..."
echo ""
echo "This will:"
echo "  ✅ Check existing data quality"
echo "  ✅ Re-fetch months with poor quality data (no campaigns)"
echo "  ✅ Skip months with rich data (has campaigns)"
echo "  ✅ Add platform filter for proper data separation"
echo ""
echo "⏱️  Estimated time: 5-10 minutes"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Cancelled"
    exit 1
fi

echo "🚀 Starting smart backfill..."
echo ""

# Run backfill WITHOUT forceRefresh - will only fetch poor quality months
curl -X POST http://localhost:3000/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "monthsToBackfill": 12,
    "platform": "meta",
    "forceRefresh": false
  }' | jq '.'

echo ""
echo "✅ Done! Check the results above."
echo ""
echo "📊 Next: Go to /reports and verify August now shows campaigns"

