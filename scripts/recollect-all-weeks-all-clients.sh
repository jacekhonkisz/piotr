#!/bin/bash

# 🚀 FULL RECOLLECTION: All Clients, All Weeks (Batch Mode)
# 
# This script triggers batch collection to avoid Vercel timeouts
# - Collects 54 weeks total (current + 53 historical)
# - Processes ALL clients (Belmonte, Hotel Lambert, etc.)
# - Uses NEW unified priority logic: daily_kpi_data → Meta API → DB columns
# - Batch size: 6 weeks per call (to stay under 5-minute timeout)
# - Total calls: 9 batches (6 weeks × 9 = 54 weeks)

set -e

API_URL="https://piotr-gamma.vercel.app/api/automated/collect-weeks-batch"
AUTH_TOKEN="KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK"
PLATFORM="meta"
BATCH_SIZE=6
TOTAL_WEEKS=54
TIMEOUT=280  # 4 minutes 40 seconds (under Vercel's 5-minute limit)

# Calculate number of batches needed
TOTAL_BATCHES=$(( ($TOTAL_WEEKS + $BATCH_SIZE - 1) / $BATCH_SIZE ))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 FULL RECOLLECTION: All Clients, All Weeks (NEW Priority Logic)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Configuration:"
echo "  • Total Weeks: $TOTAL_WEEKS (current + 53 historical)"
echo "  • Batch Size: $BATCH_SIZE weeks per call"
echo "  • Total Batches: $TOTAL_BATCHES"
echo "  • Platform: $PLATFORM"
echo "  • Timeout per batch: ${TIMEOUT}s"
echo "  • Clients: ALL active clients"
echo ""
echo "🎯 NEW Priority Logic:"
echo "  1️⃣  daily_kpi_data (booking steps, conversions)"
echo "  2️⃣  Meta API (fallback for metrics)"
echo "  3️⃣  DB columns (last resort)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SUCCESSFUL_BATCHES=0
FAILED_BATCHES=0
START_TIME=$(date +%s)

for (( batch=0; batch<$TOTAL_BATCHES; batch++ ))
do
  START_WEEK=$(( $batch * $BATCH_SIZE ))
  BATCH_NUMBER=$(( $batch + 1 ))
  
  echo "┌─────────────────────────────────────────────────────────────────┐"
  echo "│ 📦 Batch $BATCH_NUMBER of $TOTAL_BATCHES"
  echo "│ 📅 Weeks: $START_WEEK to $(( $START_WEEK + $BATCH_SIZE - 1 ))"
  echo "└─────────────────────────────────────────────────────────────────┘"
  echo ""
  
  BATCH_START=$(date +%s)
  
  # Trigger batch collection
  HTTP_CODE=$(curl -X POST "${API_URL}?startWeek=${START_WEEK}&batchSize=${BATCH_SIZE}&platform=${PLATFORM}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    --max-time $TIMEOUT \
    -w "%{http_code}" \
    -o /tmp/batch_response_${batch}.json \
    -s)
  
  BATCH_DURATION=$(( $(date +%s) - $BATCH_START ))
  
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Batch $BATCH_NUMBER completed successfully (${BATCH_DURATION}s)"
    
    # Extract and display results
    WEEKS_COLLECTED=$(jq -r '.results.totalWeeks' /tmp/batch_response_${batch}.json 2>/dev/null || echo "N/A")
    CLIENTS_PROCESSED=$(jq -r '.results.clientsProcessed' /tmp/batch_response_${batch}.json 2>/dev/null || echo "N/A")
    
    echo "   📊 Weeks collected: $WEEKS_COLLECTED"
    echo "   👥 Clients processed: $CLIENTS_PROCESSED"
    
    SUCCESSFUL_BATCHES=$(( $SUCCESSFUL_BATCHES + 1 ))
  else
    echo "❌ Batch $BATCH_NUMBER failed (HTTP $HTTP_CODE, ${BATCH_DURATION}s)"
    
    # Try to extract error message
    ERROR_MSG=$(jq -r '.error' /tmp/batch_response_${batch}.json 2>/dev/null || echo "Unknown error")
    echo "   💥 Error: $ERROR_MSG"
    
    FAILED_BATCHES=$(( $FAILED_BATCHES + 1 ))
  fi
  
  echo ""
  
  # Small delay between batches to avoid rate limiting
  if [ $batch -lt $(( $TOTAL_BATCHES - 1 )) ]; then
    echo "⏳ Waiting 3 seconds before next batch..."
    sleep 3
    echo ""
  fi
done

TOTAL_DURATION=$(( $(date +%s) - $START_TIME ))
MINUTES=$(( $TOTAL_DURATION / 60 ))
SECONDS=$(( $TOTAL_DURATION % 60 ))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 RECOLLECTION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Final Results:"
echo "  ✅ Successful batches: $SUCCESSFUL_BATCHES/$TOTAL_BATCHES"
echo "  ❌ Failed batches: $FAILED_BATCHES/$TOTAL_BATCHES"
echo "  ⏱️  Total duration: ${MINUTES}m ${SECONDS}s"
echo ""

if [ $FAILED_BATCHES -gt 0 ]; then
  echo "⚠️  Some batches failed. Check response files in /tmp/batch_response_*.json"
  echo "   You can retry failed batches manually if needed."
  echo ""
  exit 1
else
  echo "🎊 All batches completed successfully!"
  echo "   All weeks for all clients now use the NEW unified priority logic."
  echo ""
  
  # Cleanup response files
  rm -f /tmp/batch_response_*.json
  
  echo "✨ Next steps:"
  echo "  1. Check the UI to verify metrics are correct (e.g., Week 39 Belmonte)"
  echo "  2. All historical weeks should now show correct booking steps"
  echo "  3. All clients benefit from the unified data fetching method"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

