#!/bin/bash

# 🚀 POPULATE ALL 54 WEEKS FOR BELMONTE (ONE BY ONE)
# Each week takes ~60-120s, total time: ~2 hours
# This is SAFE and RELIABLE because each API call is well under timeout

API_URL="https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries"
AUTH_TOKEN="KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK"
CLIENT_FILTER="belmonte"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 POPULATE ALL 54 WEEKS - ONE BY ONE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📊 Total weeks: 54 (0-53)"
echo "  ⏱️  Time per week: ~60-120 seconds"
echo "  🎯 Total time: ~2 hours"
echo "  🔒 Safe: Each call is well under 180s timeout"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_START_TIME=$(date +%s)
SUCCESSFUL=0
FAILED=0

# Collect weeks from oldest to newest (53 → 0)
for week in {53..0}; do
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  📅 Week $week of 54${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ⏳ Starting at: $(date '+%H:%M:%S')"
  echo ""
  
  WEEK_START_TIME=$(date +%s)
  
  # Make the API call (180s timeout, but should take 60-120s)
  HTTP_CODE=$(curl -s -o /tmp/week_${week}_response.json -w "%{http_code}" \
    -X POST "${API_URL}?testClient=${CLIENT_FILTER}&startWeek=${week}&endWeek=${week}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    --max-time 180)
  
  WEEK_END_TIME=$(date +%s)
  WEEK_DURATION=$((WEEK_END_TIME - WEEK_START_TIME))
  
  # Check response
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "  ${GREEN}✅ SUCCESS${NC}"
    echo -e "  ⏱️  Duration: ${GREEN}${WEEK_DURATION}s${NC}"
    SUCCESSFUL=$((SUCCESSFUL + 1))
  else
    echo -e "  ${RED}❌ FAILED${NC}"
    echo -e "  📊 HTTP Code: ${RED}$HTTP_CODE${NC}"
    echo -e "  ⏱️  Duration: ${RED}${WEEK_DURATION}s${NC}"
    FAILED=$((FAILED + 1))
    
    # Show error
    if [ -f /tmp/week_${week}_response.json ]; then
      echo -e "  ${RED}Error:${NC}"
      cat /tmp/week_${week}_response.json | head -5
    fi
  fi
  
  # Progress
  COMPLETED=$((SUCCESSFUL + FAILED))
  REMAINING=$((54 - COMPLETED))
  echo -e "  📈 Progress: ${COMPLETED}/54 complete"
  echo -e "  ✅ Successful: ${GREEN}${SUCCESSFUL}${NC}"
  if [ $FAILED -gt 0 ]; then
    echo -e "  ❌ Failed: ${RED}${FAILED}${NC}"
  fi
  echo -e "  ⏳ Remaining: ${REMAINING} weeks"
  
  # Estimate
  TOTAL_ELAPSED=$((WEEK_END_TIME - TOTAL_START_TIME))
  if [ $COMPLETED -gt 0 ]; then
    AVG_TIME_PER_WEEK=$((TOTAL_ELAPSED / COMPLETED))
    EST_REMAINING_TIME=$((AVG_TIME_PER_WEEK * REMAINING))
    EST_MINUTES=$((EST_REMAINING_TIME / 60))
    echo -e "  ⏱️  Est. remaining: ${YELLOW}~${EST_MINUTES} minutes${NC}"
  fi
  
  echo ""
  
  # Small delay between weeks
  if [ $week -gt 0 ]; then
    echo -e "  ⏸️  Waiting 5 seconds before next week..."
    sleep 5
  fi
done

# Final summary
TOTAL_END_TIME=$(date +%s)
TOTAL_DURATION=$((TOTAL_END_TIME - TOTAL_START_TIME))
MINUTES=$((TOTAL_DURATION / 60))
SECONDS=$((TOTAL_DURATION % 60))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🏁 COLLECTION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ✅ Successful: ${GREEN}${SUCCESSFUL}/54${NC}"

if [ $FAILED -gt 0 ]; then
  echo -e "  ❌ Failed: ${RED}${FAILED}/54${NC}"
fi

echo -e "  ⏱️  Total time: ${YELLOW}${MINUTES}m ${SECONDS}s${NC}"
echo ""

if [ $SUCCESSFUL -eq 54 ]; then
  echo -e "  ${GREEN}🎉 ALL WEEKS COLLECTED SUCCESSFULLY!${NC}"
  echo ""
  echo "  📊 Next: Verify in Supabase"
  echo "  💡 Run: npx tsx scripts/check-belmonte-collection-status.sql"
else
  echo -e "  ${YELLOW}⚠️  Some weeks failed. You can retry failed weeks:${NC}"
  echo ""
  echo "  For each failed week, run:"
  echo "  curl -X POST '${API_URL}?testClient=${CLIENT_FILTER}&startWeek=X&endWeek=X' \\"
  echo "    -H 'Authorization: Bearer ${AUTH_TOKEN}' --max-time 180"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup
rm -f /tmp/week_*_response.json

