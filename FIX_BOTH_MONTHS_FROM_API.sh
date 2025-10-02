#!/bin/bash
# ============================================================================
# FIX AUGUST & SEPTEMBER - FETCH FROM META ADS API
# ============================================================================
# This script will re-fetch both months from Meta Ads API
# to get complete campaign and conversion data
# ============================================================================

echo "🔧 Fixing August and September 2025 data"
echo "========================================"
echo ""

# Replace with your actual domain
DOMAIN="your-domain.com"  # CHANGE THIS!

# August 2025
echo "📅 Re-fetching AUGUST 2025 data..."
echo "This will fetch both campaign metrics AND conversion data from Meta Ads API"
echo ""

curl -X POST "https://${DOMAIN}/api/automated/monthly-aggregation" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 8
  }'

echo ""
echo "✅ August request sent"
echo ""
echo "Waiting 5 seconds before September..."
sleep 5
echo ""

# September 2025
echo "📅 Re-fetching SEPTEMBER 2025 data..."
echo "This will fetch both campaign metrics AND conversion data from Meta Ads API"
echo ""

curl -X POST "https://${DOMAIN}/api/automated/monthly-aggregation" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 9
  }'

echo ""
echo "✅ September request sent"
echo ""
echo "========================================"
echo "🎉 Both months requested for re-aggregation"
echo ""
echo "⏱️  Wait 2-3 minutes for completion"
echo "📊 Then check /reports page"
echo "========================================"

