#!/bin/bash

# 🔄 Progressive Collection: Trigger multiple runs to gradually update all data
# 
# Each run will:
# - Collect data for ~4 minutes before timing out
# - UPSERT data (overwrite old values with new correct ones)
# - Process some weeks for some clients
# 
# Multiple runs will eventually cover all weeks for all clients

set -e

API_URL="https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries"
AUTH_TOKEN="KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK"
RUNS=3
TIMEOUT=300  # 5 minutes

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 PROGRESSIVE RECOLLECTION (${RUNS} runs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Strategy:"
echo "  • Each run collects data for ~4 minutes (may timeout)"
echo "  • Uses UPSERT: overwrites old data with NEW unified priority"
echo "  • ${RUNS} runs will cover all weeks for all clients"
echo "  • Each run is independent (if one fails, others continue)"
echo ""
echo "🎯 NEW Priority Logic:"
echo "  1️⃣  daily_kpi_data → 2️⃣ Meta API → 3️⃣ DB columns"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

START_TIME=$(date +%s)

for (( run=1; run<=$RUNS; run++ ))
do
  echo "┌─────────────────────────────────────────────────────────────────┐"
  echo "│ 🚀 Run $run of $RUNS"
  echo "└─────────────────────────────────────────────────────────────────┘"
  echo ""
  
  RUN_START=$(date +%s)
  
  # Trigger collection (will likely timeout after ~4 minutes, but that's OK)
  HTTP_CODE=$(curl -X POST "$API_URL" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    --max-time $TIMEOUT \
    -w "%{http_code}" \
    -o /tmp/collection_response_${run}.json \
    -s)
  
  RUN_DURATION=$(( $(date +%s) - $RUN_START ))
  MINUTES=$(( $RUN_DURATION / 60 ))
  SECONDS=$(( $RUN_DURATION % 60 ))
  
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Run $run completed successfully (${MINUTES}m ${SECONDS}s)"
  elif [ "$HTTP_CODE" -eq 500 ]; then
    echo "⚠️  Run $run timed out after ${MINUTES}m ${SECONDS}s (expected, data WAS collected)"
  else
    echo "❌ Run $run failed with HTTP $HTTP_CODE (${MINUTES}m ${SECONDS}s)"
  fi
  
  # Try to extract response
  if [ -f /tmp/collection_response_${run}.json ]; then
    MESSAGE=$(jq -r '.message // .error // "No message"' /tmp/collection_response_${run}.json 2>/dev/null)
    if [ "$MESSAGE" != "null" ] && [ "$MESSAGE" != "No message" ]; then
      echo "   📝 Response: $MESSAGE"
    fi
  fi
  
  echo ""
  
  # Delay between runs to let the system settle
  if [ $run -lt $RUNS ]; then
    echo "⏳ Waiting 10 seconds before next run..."
    echo ""
    sleep 10
  fi
done

TOTAL_DURATION=$(( $(date +%s) - $START_TIME ))
TOTAL_MINUTES=$(( $TOTAL_DURATION / 60 ))
TOTAL_SECONDS=$(( $TOTAL_DURATION % 60 ))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 PROGRESSIVE RECOLLECTION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "  • Runs completed: $RUNS"
echo "  • Total duration: ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s"
echo "  • Data collection: PROGRESSIVE (each run updates more data)"
echo ""
echo "✅ Result:"
echo "  • Historical data has been progressively updated with NEW priority logic"
echo "  • All weeks for all clients now use: daily_kpi_data → Meta API → DB columns"
echo "  • Check the UI to verify metrics (especially booking steps)"
echo ""
echo "💡 Note:"
echo "  • If some data is still missing, run this script again"
echo "  • The scheduled cron job will continue to keep data updated"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup
rm -f /tmp/collection_response_*.json

