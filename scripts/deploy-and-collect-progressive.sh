#!/bin/bash

# 🚀 DEPLOY AND RUN PROGRESSIVE COLLECTION
# This script deploys the changes and then runs the progressive collection

set -e  # Exit on any error

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 DEPLOY AND RUN PROGRESSIVE COLLECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Deploy to production
echo -e "${BLUE}📦 Step 1: Deploying to production...${NC}"
echo ""

git add -A
git commit -m "feat: implement progressive weekly collection with week ranges

- Add startWeek/endWeek parameters to API endpoint
- Change batch processing to sequential (not parallel) to avoid rate limits
- Create progressive collection script (11 batches of 5 weeks)
- Each batch takes ~15-20s, total ~3-4 minutes
- Reliable, no timeout issues"

git push origin main

echo ""
echo -e "${GREEN}✅ Git push complete${NC}"
echo ""
echo -e "${YELLOW}⏳ Waiting 60 seconds for Vercel deployment...${NC}"
echo ""

# Progress bar for waiting
for i in {1..60}; do
  echo -n "."
  sleep 1
  if [ $((i % 10)) -eq 0 ]; then
    echo -n " ${i}s"
  fi
done
echo ""
echo ""

echo -e "${GREEN}✅ Deployment should be complete${NC}"
echo ""

# Step 2: Run progressive collection
echo -e "${BLUE}📊 Step 2: Running progressive collection for Belmonte...${NC}"
echo ""

./scripts/progressive-collection-belmonte.sh

echo ""
echo -e "${GREEN}🎉 ALL DONE!${NC}"
echo ""

