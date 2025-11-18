#!/bin/bash

# 🧪 TEST: Single week collection for Belmonte
# This tests if collecting just 1 week at a time works reliably

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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🧪 TESTING: Single Week Collection - Belmonte"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📅 Testing Week 0 (current week)"
echo "  ⏱️  Expected time: ~3-5 seconds"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

START_TIME=$(date +%s)

echo -e "${BLUE}📡 Making API call...${NC}"
echo ""

# Make the API call for JUST week 0
curl -X POST "${API_URL}?testClient=${CLIENT_FILTER}&startWeek=0&endWeek=0" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -w "\n\n📊 HTTP: %{http_code} | ⏱️  Time: %{time_total}s\n" \
  --max-time 60 \
  2>&1 | tee /tmp/single_week_test.log

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if it was successful
if grep -q "\"success\":true" /tmp/single_week_test.log || grep -q "200" /tmp/single_week_test.log; then
  echo -e "  ${GREEN}✅ SUCCESS!${NC}"
  echo -e "  ⏱️  Duration: ${GREEN}${DURATION}s${NC}"
  echo ""
  echo "  💡 Single week collection WORKS!"
  echo "  📊 Next: Try collecting 3 more weeks individually..."
  echo ""
  echo "  Would you like to proceed with:"
  echo "  A) Collect 54 individual API calls (54 weeks, one by one)"
  echo "  B) Collect week 1, 2, 3 as a test first"
else
  echo -e "  ${RED}❌ FAILED${NC}"
  echo -e "  ⏱️  Duration: ${RED}${DURATION}s${NC}"
  echo ""
  echo "  💡 Even single week collection is failing!"
  echo "  🔍 Check logs above for the error"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

