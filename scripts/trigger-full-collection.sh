#!/bin/bash

# 🚀 TRIGGER FULL HISTORICAL DATA COLLECTION
# This script collects all 54 weeks of data in batches to avoid timeouts

set -e

# Configuration
DEPLOYMENT_URL="https://piotr-gamma.vercel.app"
CRON_SECRET="${CRON_SECRET:-KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK}"
BATCH_SIZE=5  # Collect 5 weeks per batch (safe, takes ~60 seconds)
TOTAL_WEEKS=54  # 53 past weeks + 1 current week
PLATFORM="meta"  # or "google"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 FULL HISTORICAL DATA COLLECTION${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""
echo -e "Total weeks to collect: ${GREEN}${TOTAL_WEEKS}${NC}"
echo -e "Batch size: ${GREEN}${BATCH_SIZE}${NC} weeks per batch"
echo -e "Total batches: ${GREEN}$(( (TOTAL_WEEKS + BATCH_SIZE - 1) / BATCH_SIZE ))${NC}"
echo -e "Platform: ${GREEN}${PLATFORM}${NC}"
echo ""

# Calculate number of batches
NUM_BATCHES=$(( (TOTAL_WEEKS + BATCH_SIZE - 1) / BATCH_SIZE ))

# Track results
TOTAL_SUCCESS=0
TOTAL_FAILED=0
TOTAL_WEEKS_COLLECTED=0

# Collect each batch
for (( batch=0; batch<NUM_BATCHES; batch++ ))
do
  START_WEEK=$(( batch * BATCH_SIZE ))
  
  echo -e "${YELLOW}📊 Batch $(( batch + 1 ))/${NUM_BATCHES}: Collecting weeks ${START_WEEK}-$(( START_WEEK + BATCH_SIZE - 1 ))${NC}"
  echo ""
  
  # Make API call
  RESPONSE=$(curl -s -X POST "${DEPLOYMENT_URL}/api/automated/collect-weeks-batch?startWeek=${START_WEEK}&batchSize=${BATCH_SIZE}&platform=${PLATFORM}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_CODE:%{http_code}")
  
  # Extract HTTP code
  HTTP_CODE=$(echo "$RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Batch $(( batch + 1 )) completed successfully${NC}"
    
    # Parse response
    WEEKS_COLLECTED=$(echo "$BODY" | grep -o '"totalWeeks":[0-9]*' | cut -d: -f2)
    CLIENTS_PROCESSED=$(echo "$BODY" | grep -o '"clientsProcessed":[0-9]*' | cut -d: -f2)
    DURATION=$(echo "$BODY" | grep -o '"durationMs":[0-9]*' | cut -d: -f2)
    
    echo -e "  📅 Weeks collected: ${GREEN}${WEEKS_COLLECTED}${NC}"
    echo -e "  👥 Clients processed: ${GREEN}${CLIENTS_PROCESSED}${NC}"
    echo -e "  ⏱️  Duration: ${GREEN}$(( DURATION / 1000 ))s${NC}"
    echo ""
    
    TOTAL_WEEKS_COLLECTED=$(( TOTAL_WEEKS_COLLECTED + WEEKS_COLLECTED ))
    TOTAL_SUCCESS=$(( TOTAL_SUCCESS + 1 ))
  else
    echo -e "${RED}❌ Batch $(( batch + 1 )) failed (HTTP ${HTTP_CODE})${NC}"
    echo -e "${RED}Response: ${BODY}${NC}"
    echo ""
    TOTAL_FAILED=$(( TOTAL_FAILED + 1 ))
  fi
  
  # Wait between batches to avoid rate limiting
  if [ $batch -lt $(( NUM_BATCHES - 1 )) ]; then
    echo -e "${BLUE}⏳ Waiting 2 seconds before next batch...${NC}"
    echo ""
    sleep 2
  fi
done

# Summary
echo ""
echo -e "${BLUE}===================================${NC}"
echo -e "${BLUE}📊 COLLECTION SUMMARY${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""
echo -e "Batches successful: ${GREEN}${TOTAL_SUCCESS}${NC} / ${NUM_BATCHES}"
echo -e "Batches failed: ${RED}${TOTAL_FAILED}${NC} / ${NUM_BATCHES}"
echo -e "Total weeks collected: ${GREEN}${TOTAL_WEEKS_COLLECTED}${NC}"
echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL BATCHES COMPLETED SUCCESSFULLY!${NC}"
  echo ""
  echo -e "${GREEN}🎉 Historical data collection complete!${NC}"
  echo ""
  echo -e "Next steps:"
  echo -e "1. Check reports page: ${BLUE}${DEPLOYMENT_URL}/reports${NC}"
  echo -e "2. Verify conversion metrics are populated"
  echo -e "3. All weeks should now have complete data"
else
  echo -e "${RED}⚠️  SOME BATCHES FAILED${NC}"
  echo -e "Please check the errors above and retry failed batches"
fi

echo ""

