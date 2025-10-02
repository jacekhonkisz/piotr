#!/bin/bash
# ============================================================================
# RUN DATA BACKFILL FOR ALL CLIENTS
# ============================================================================
# This script executes comprehensive data backfill for all clients
# ============================================================================

set -e  # Exit on error

echo "============================================"
echo "🚀 DATA BACKFILL EXECUTION"
echo "============================================"
echo ""

# Configuration
DOMAIN="${DOMAIN:-localhost:3000}"
PROTOCOL="${PROTOCOL:-http}"
MONTHS="${MONTHS:-12}"
PLATFORM="${PLATFORM:-all}"
FORCE_REFRESH="${FORCE_REFRESH:-false}"

echo "📋 Configuration:"
echo "   Domain: $PROTOCOL://$DOMAIN"
echo "   Months to backfill: $MONTHS"
echo "   Platform: $PLATFORM"
echo "   Force refresh: $FORCE_REFRESH"
echo ""

# Ask for confirmation
read -p "⚠️  This will fetch data from APIs for all clients. Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Backfill cancelled"
    exit 1
fi

echo ""
echo "🔄 Starting backfill..."
echo ""

# Execute backfill
RESPONSE=$(curl -s -X POST "$PROTOCOL://$DOMAIN/api/backfill-all-client-data" \
  -H "Content-Type: application/json" \
  -d "{
    \"monthsToBackfill\": $MONTHS,
    \"clientIds\": [],
    \"platform\": \"$PLATFORM\",
    \"forceRefresh\": $FORCE_REFRESH
  }")

# Check if request was successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ BACKFILL COMPLETED SUCCESSFULLY"
    echo ""
    
    # Parse and display summary
    echo "📊 Summary:"
    echo "$RESPONSE" | jq -r '.summary | "   Total Clients: \(.totalClients)\n   Total Attempts: \(.totalAttempts)\n   ✅ Success: \(.successCount)\n   ❌ Failed: \(.failedCount)\n   ⏭️  Skipped: \(.skippedCount)\n   ⏱️  Time: \(.executionTimeReadable)"'
    
    echo ""
    echo "📋 Detailed results saved to: backfill-results.json"
    echo "$RESPONSE" | jq '.' > backfill-results.json
    
    echo ""
    echo "============================================"
    echo "🎉 BACKFILL COMPLETE"
    echo "============================================"
    echo ""
    echo "Next steps:"
    echo "1. Check /reports page to verify data"
    echo "2. Review backfill-results.json for details"
    echo "3. Check for any failed requests"
    echo ""
    
else
    echo "❌ BACKFILL FAILED"
    echo ""
    echo "Error response:"
    echo "$RESPONSE" | jq '.'
    
    exit 1
fi

