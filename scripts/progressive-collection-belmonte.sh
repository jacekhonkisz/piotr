#!/bin/bash

# 🚀 PROGRESSIVE WEEKLY DATA COLLECTION FOR BELMONTE
# Splits 54 weeks into 11 separate API calls of 5 weeks each
# Each call takes ~15-20 seconds, completely reliable

API_URL="https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries"
AUTH_TOKEN="KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK"
CLIENT_FILTER="belmonte"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 PROGRESSIVE WEEKLY DATA COLLECTION - BELMONTE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📊 Total weeks to collect: 54 (0-53)"
echo "  📦 Split into: 11 batches of 5 weeks each"
echo "  ⏱️  Expected time per batch: ~15-20 seconds"
echo "  🎯 Total expected time: ~3-4 minutes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Track overall statistics
TOTAL_BATCHES=11
SUCCESSFUL_BATCHES=0
FAILED_BATCHES=0
TOTAL_START_TIME=$(date +%s)

# Function to make a single API call
collect_week_range() {
  local START_WEEK=$1
  local END_WEEK=$2
  local BATCH_NUM=$3
  local WEEK_COUNT=$((END_WEEK - START_WEEK + 1))
  
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  📦 BATCH $BATCH_NUM/$TOTAL_BATCHES${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  📅 Week range: ${YELLOW}$START_WEEK → $END_WEEK${NC} ($WEEK_COUNT weeks)"
  echo -e "  ⏳ Starting at: $(date '+%H:%M:%S')"
  echo ""
  
  BATCH_START_TIME=$(date +%s)
  
  # Make the API call
  HTTP_CODE=$(curl -s -o /tmp/batch_response_$BATCH_NUM.json -w "%{http_code}" \
    -X POST "${API_URL}?testClient=${CLIENT_FILTER}&startWeek=${START_WEEK}&endWeek=${END_WEEK}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    --max-time 180)
  
  BATCH_END_TIME=$(date +%s)
  BATCH_DURATION=$((BATCH_END_TIME - BATCH_START_TIME))
  
  # Check response
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "  ${GREEN}✅ SUCCESS${NC}"
    echo -e "  📊 HTTP Code: ${GREEN}$HTTP_CODE${NC}"
    echo -e "  ⏱️  Duration: ${GREEN}${BATCH_DURATION}s${NC}"
    SUCCESSFUL_BATCHES=$((SUCCESSFUL_BATCHES + 1))
    
    # Extract and display key metrics from response
    if [ -f /tmp/batch_response_$BATCH_NUM.json ]; then
      WEEKS_COLLECTED=$(grep -o '"weeksCollected":[0-9]*' /tmp/batch_response_$BATCH_NUM.json | grep -o '[0-9]*' || echo "N/A")
      echo -e "  📈 Weeks collected: ${GREEN}$WEEKS_COLLECTED${NC}"
    fi
  else
    echo -e "  ${RED}❌ FAILED${NC}"
    echo -e "  📊 HTTP Code: ${RED}$HTTP_CODE${NC}"
    echo -e "  ⏱️  Duration: ${RED}${BATCH_DURATION}s${NC}"
    FAILED_BATCHES=$((FAILED_BATCHES + 1))
    
    # Show error response
    if [ -f /tmp/batch_response_$BATCH_NUM.json ]; then
      echo ""
      echo -e "  ${RED}Error Response:${NC}"
      cat /tmp/batch_response_$BATCH_NUM.json | head -10
    fi
  fi
  
  echo ""
  
  # Small delay between batches
  if [ $BATCH_NUM -lt $TOTAL_BATCHES ]; then
    echo -e "  ⏸️  Waiting 3 seconds before next batch..."
    sleep 3
  fi
}

# Execute 11 batches (5 weeks each)
collect_week_range 0 4 1
collect_week_range 5 9 2
collect_week_range 10 14 3
collect_week_range 15 19 4
collect_week_range 20 24 5
collect_week_range 25 29 6
collect_week_range 30 34 7
collect_week_range 35 39 8
collect_week_range 40 44 9
collect_week_range 45 49 10
collect_week_range 50 53 11  # Last batch is 4 weeks (50-53)

# Calculate total time
TOTAL_END_TIME=$(date +%s)
TOTAL_DURATION=$((TOTAL_END_TIME - TOTAL_START_TIME))
MINUTES=$((TOTAL_DURATION / 60))
SECONDS=$((TOTAL_DURATION % 60))

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🏁 COLLECTION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ✅ Successful batches: ${GREEN}$SUCCESSFUL_BATCHES/$TOTAL_BATCHES${NC}"

if [ $FAILED_BATCHES -gt 0 ]; then
  echo -e "  ❌ Failed batches: ${RED}$FAILED_BATCHES/$TOTAL_BATCHES${NC}"
fi

echo -e "  ⏱️  Total time: ${YELLOW}${MINUTES}m ${SECONDS}s${NC}"
echo ""

if [ $SUCCESSFUL_BATCHES -eq $TOTAL_BATCHES ]; then
  echo -e "  ${GREEN}🎉 ALL BATCHES COMPLETED SUCCESSFULLY!${NC}"
  echo ""
  echo "  📊 Next step: Verify data in Supabase"
  echo "  💡 Run: npx tsx scripts/check-belmonte-collection-status.sql"
else
  echo -e "  ${YELLOW}⚠️  Some batches failed. Check logs above for details.${NC}"
  echo ""
  echo "  💡 You can re-run failed batches individually:"
  echo "     curl -X POST '${API_URL}?testClient=${CLIENT_FILTER}&startWeek=X&endWeek=Y' \\"
  echo "       -H 'Authorization: Bearer ${AUTH_TOKEN}'"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup
rm -f /tmp/batch_response_*.json

