#!/bin/bash

# Batch Re-collect ALL Weekly Data for ALL Clients
# This will collect 53 weeks of historical data using the fixed ISO week logic
# Run after: complete-weekly-reset.sql and code deployment

set -e  # Exit on error

echo "🚀 BATCH WEEKLY DATA RE-COLLECTION"
echo "======================================"
echo ""
echo "This will:"
echo "  - Collect last 53 weeks for ALL clients"
echo "  - Use fixed ISO week logic (Monday start)"
echo "  - Take approximately 20-40 minutes"
echo ""

# Configuration
API_URL="${NEXT_PUBLIC_SITE_URL:-https://piotr-gamma.vercel.app}"
CRON_SECRET="${CRON_SECRET}"

if [ -z "$CRON_SECRET" ]; then
  echo "❌ ERROR: CRON_SECRET environment variable not set"
  echo ""
  echo "Please set it:"
  echo "  export CRON_SECRET='your-cron-secret-here'"
  echo ""
  exit 1
fi

# Get list of all clients from API or database
# For now, we'll trigger the collection endpoint which processes all clients

echo "📊 Triggering collection for ALL clients..."
echo "   Endpoint: /api/automated/collect-weekly-summaries"
echo "   Scope: Last 53 completed weeks"
echo ""

START_TIME=$(date +%s)

# Trigger the collection
RESPONSE=$(curl -X POST "${API_URL}/api/automated/collect-weekly-summaries" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}" \
  -s)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "======================================"
echo "📊 COLLECTION RESULT"
echo "======================================"
echo "HTTP Status: $HTTP_CODE"
echo "Duration: ${DURATION}s"
echo ""
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Collection completed successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Wait for collection to complete (~${DURATION}s per run)"
  echo "  2. Verify: npx tsx scripts/check-weekly-duplicates.ts"
  echo "  3. Check database: All weeks should start on Monday"
else
  echo "❌ Collection failed with HTTP $HTTP_CODE"
  echo ""
  echo "Troubleshooting:"
  echo "  - Check Vercel logs for errors"
  echo "  - Verify CRON_SECRET is correct"
  echo "  - Ensure code was deployed successfully"
  exit 1
fi

