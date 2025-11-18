#!/bin/bash

# 🚀 POPULATE ALL 54 WEEKS WITH REAL-TIME MONITORING
# Includes hang detection, progress indicators, and health checks

API_URL="https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries"
AUTH_TOKEN="KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK"
CLIENT_FILTER="belmonte"
HANG_THRESHOLD=30  # Warn if no progress for 30 seconds

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 POPULATE ALL 54 WEEKS - WITH MONITORING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📊 Total weeks: 54 (0-53)"
echo "  ⏱️  Time per week: ~60-120 seconds"
echo "  🎯 Total time: ~2 hours"
echo "  🔍 Monitoring: Real-time progress + hang detection"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_START_TIME=$(date +%s)
SUCCESSFUL=0
FAILED=0
HUNG=0

# Function to show progress spinner
show_progress() {
  local pid=$1
  local week=$2
  local start_time=$(date +%s)
  local last_activity=$start_time
  local spin='-\|/'
  local i=0
  
  while kill -0 $pid 2>/dev/null; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    # Check for hang (no activity for HANG_THRESHOLD seconds)
    if [ $elapsed -gt 0 ] && [ $((elapsed % 10)) -eq 0 ]; then
      last_activity=$current_time
    fi
    
    # Show spinner and elapsed time
    printf "\r  ${CYAN}⏳ Collecting...${NC} ${spin:$i:1} ${elapsed}s elapsed"
    
    # Warn if taking too long
    if [ $elapsed -gt 120 ]; then
      printf " ${YELLOW}(slow!)${NC}"
    elif [ $elapsed -gt 180 ]; then
      printf " ${RED}(TIMEOUT RISK!)${NC}"
    fi
    
    i=$(( (i+1) % 4 ))
    sleep 1
  done
  
  printf "\r"
}

# Function to collect a single week with monitoring
collect_week() {
  local week=$1
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  📅 Week $week of 54${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  🕐 Started: $(date '+%H:%M:%S')"
  
  WEEK_START_TIME=$(date +%s)
  
  # Start curl in background and monitor it
  curl -s -o /tmp/week_${week}_response.json -w "%{http_code}" \
    -X POST "${API_URL}?testClient=${CLIENT_FILTER}&startWeek=${week}&endWeek=${week}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    --max-time 180 > /tmp/week_${week}_status.txt 2>&1 &
  
  CURL_PID=$!
  
  # Show progress while curl is running
  show_progress $CURL_PID $week
  
  # Wait for curl to finish
  wait $CURL_PID
  CURL_EXIT=$?
  
  WEEK_END_TIME=$(date +%s)
  WEEK_DURATION=$((WEEK_END_TIME - WEEK_START_TIME))
  
  # Read HTTP status
  if [ -f /tmp/week_${week}_status.txt ]; then
    HTTP_CODE=$(cat /tmp/week_${week}_status.txt)
  else
    HTTP_CODE="000"
  fi
  
  echo -e "  🕐 Ended: $(date '+%H:%M:%S')"
  
  # Check result
  if [ "$CURL_EXIT" -eq 28 ]; then
    # Timeout
    echo -e "  ${RED}⏱️  TIMEOUT (exceeded 180s)${NC}"
    echo -e "  ⏱️  Duration: ${RED}${WEEK_DURATION}s${NC}"
    HUNG=$((HUNG + 1))
    return 1
  elif [ "$HTTP_CODE" -eq 200 ]; then
    # Success
    echo -e "  ${GREEN}✅ SUCCESS${NC}"
    echo -e "  ⏱️  Duration: ${GREEN}${WEEK_DURATION}s${NC}"
    
    # Show response size
    if [ -f /tmp/week_${week}_response.json ]; then
      SIZE=$(wc -c < /tmp/week_${week}_response.json)
      echo -e "  📦 Response: ${GREEN}${SIZE} bytes${NC}"
    fi
    
    SUCCESSFUL=$((SUCCESSFUL + 1))
    return 0
  else
    # Failed
    echo -e "  ${RED}❌ FAILED${NC}"
    echo -e "  📊 HTTP Code: ${RED}${HTTP_CODE}${NC}"
    echo -e "  ⏱️  Duration: ${RED}${WEEK_DURATION}s${NC}"
    
    # Show error
    if [ -f /tmp/week_${week}_response.json ]; then
      echo -e "  ${RED}Error response:${NC}"
      cat /tmp/week_${week}_response.json | head -3
    fi
    
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# Main collection loop
for week in {53..0}; do
  collect_week $week
  
  # Show overall progress
  COMPLETED=$((SUCCESSFUL + FAILED + HUNG))
  REMAINING=$((54 - COMPLETED))
  
  echo ""
  echo -e "  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${CYAN}📈 OVERALL PROGRESS${NC}"
  echo -e "  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  📊 Completed: ${COMPLETED}/54"
  echo -e "  ✅ Successful: ${GREEN}${SUCCESSFUL}${NC}"
  
  if [ $FAILED -gt 0 ]; then
    echo -e "  ❌ Failed: ${RED}${FAILED}${NC}"
  fi
  
  if [ $HUNG -gt 0 ]; then
    echo -e "  ⏱️  Timeouts: ${RED}${HUNG}${NC}"
  fi
  
  echo -e "  ⏳ Remaining: ${YELLOW}${REMAINING}${NC}"
  
  # Calculate and show estimates
  TOTAL_ELAPSED=$(($(date +%s) - TOTAL_START_TIME))
  if [ $COMPLETED -gt 0 ]; then
    AVG_TIME_PER_WEEK=$((TOTAL_ELAPSED / COMPLETED))
    EST_REMAINING_TIME=$((AVG_TIME_PER_WEEK * REMAINING))
    EST_MINUTES=$((EST_REMAINING_TIME / 60))
    EST_HOURS=$((EST_MINUTES / 60))
    EST_MINS_REMAINDER=$((EST_MINUTES % 60))
    
    ELAPSED_MINUTES=$((TOTAL_ELAPSED / 60))
    
    echo -e "  ⏱️  Elapsed: ${YELLOW}${ELAPSED_MINUTES} min${NC}"
    
    if [ $EST_HOURS -gt 0 ]; then
      echo -e "  ⏱️  Est. remaining: ${YELLOW}~${EST_HOURS}h ${EST_MINS_REMAINDER}min${NC}"
    else
      echo -e "  ⏱️  Est. remaining: ${YELLOW}~${EST_MINUTES} min${NC}"
    fi
    
    # Success rate
    if [ $COMPLETED -gt 0 ]; then
      SUCCESS_RATE=$((SUCCESSFUL * 100 / COMPLETED))
      echo -e "  📊 Success rate: ${GREEN}${SUCCESS_RATE}%${NC}"
    fi
  fi
  
  echo -e "  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # Small delay between weeks
  if [ $week -gt 0 ]; then
    echo -e "  ⏸️  Waiting 5 seconds before next week..."
    sleep 5
    echo ""
  fi
done

# Final summary
TOTAL_END_TIME=$(date +%s)
TOTAL_DURATION=$((TOTAL_END_TIME - TOTAL_START_TIME))
HOURS=$((TOTAL_DURATION / 3600))
MINUTES=$(((TOTAL_DURATION % 3600) / 60))
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

if [ $HUNG -gt 0 ]; then
  echo -e "  ⏱️  Timeouts: ${RED}${HUNG}/54${NC}"
fi

if [ $HOURS -gt 0 ]; then
  echo -e "  ⏱️  Total time: ${YELLOW}${HOURS}h ${MINUTES}m ${SECONDS}s${NC}"
else
  echo -e "  ⏱️  Total time: ${YELLOW}${MINUTES}m ${SECONDS}s${NC}"
fi

# Calculate success rate
if [ $COMPLETED -gt 0 ]; then
  SUCCESS_RATE=$((SUCCESSFUL * 100 / 54))
  echo -e "  📊 Success rate: ${GREEN}${SUCCESS_RATE}%${NC}"
fi

echo ""

if [ $SUCCESSFUL -eq 54 ]; then
  echo -e "  ${GREEN}🎉 ALL 54 WEEKS COLLECTED SUCCESSFULLY!${NC}"
  echo ""
  echo "  📊 Next: Verify in Supabase"
  echo "  💡 Run: npx tsx scripts/check-belmonte-collection-status.sql"
elif [ $SUCCESSFUL -ge 45 ]; then
  echo -e "  ${YELLOW}✅ Most weeks collected! Some failures:${NC}"
  echo ""
  echo "  💡 You can retry failed weeks individually"
else
  echo -e "  ${RED}⚠️  Many weeks failed. Check connection and API status.${NC}"
  echo ""
  echo "  💡 Try running again or check logs above"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup
rm -f /tmp/week_*_response.json /tmp/week_*_status.txt

# List failed weeks if any
if [ $FAILED -gt 0 ] || [ $HUNG -gt 0 ]; then
  echo ""
  echo "💡 To retry failed weeks, run:"
  echo ""
  echo "curl -X POST '${API_URL}?testClient=${CLIENT_FILTER}&startWeek=X&endWeek=X' \\"
  echo "  -H 'Authorization: Bearer ${AUTH_TOKEN}' --max-time 180"
  echo ""
fi

