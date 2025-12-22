#!/bin/bash

# Test Cron Endpoints Script
# Run this before deploying to verify all cron endpoints work

echo "🧪 Testing Cron Endpoints"
echo "========================"
echo ""

# Configuration
BASE_URL="${1:-http://localhost:3000}"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local name=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing: $name... "
    
    # Make the request
    response=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL$endpoint" 2>&1)
    
    # Check if request was successful
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo "Testing against: $BASE_URL"
echo ""

# Critical Cache Refresh Jobs (Every 3 Hours)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Cache Refresh Jobs (Every 3 Hours)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "/api/automated/refresh-3hour-cache" "3-Hour Cache Refresh"
test_endpoint "/api/automated/refresh-current-month-cache" "Current Month Cache (Meta)"
test_endpoint "/api/automated/refresh-current-week-cache" "Current Week Cache (Meta)"
test_endpoint "/api/automated/refresh-google-ads-current-month-cache" "Current Month Cache (Google Ads)"
test_endpoint "/api/automated/refresh-google-ads-current-week-cache" "Current Week Cache (Google Ads)"
test_endpoint "/api/automated/refresh-social-media-cache" "Social Media Cache"
echo ""

# Daily Jobs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📅 Daily Jobs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "/api/automated/daily-kpi-collection" "Daily KPI Collection (01:00 UTC)"
test_endpoint "/api/automated/google-ads-daily-collection" "Google Ads Daily Collection (01:15 UTC)"
test_endpoint "/api/automated/send-scheduled-reports" "Send Scheduled Reports (09:00 UTC)"
test_endpoint "/api/background/collect-weekly" "Weekly Background Collection (00:01 UTC)"
echo ""

# Weekly Jobs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📆 Weekly Jobs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "/api/automated/archive-completed-weeks" "Archive Completed Weeks (Mon 03:00)"
test_endpoint "/api/background/cleanup-old-data" "Cleanup Old Data (Sat 02:00)"
test_endpoint "/api/background/cleanup-executive-summaries" "Cleanup AI Summaries (Sat 03:00)"
test_endpoint "/api/background/collect-monthly" "Monthly Background Collection (Sun 23:00)"
echo ""

# Monthly Jobs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗓️  Monthly Jobs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "/api/automated/end-of-month-collection" "End of Month Collection (1st @ 02:00)"
test_endpoint "/api/automated/archive-completed-months" "Archive Completed Months (1st @ 02:30)"
test_endpoint "/api/automated/cleanup-old-data" "Monthly Cleanup (1st @ 04:00)"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

# Exit status
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Ready for deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit changes: git add vercel.json && git commit -m 'feat: Configure production cron jobs'"
    echo "2. Push to main: git push origin main"
    echo "3. Deploy to Vercel: vercel --prod"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please fix the issues before deploying.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Make sure dev server is running: npm run dev"
    echo "2. Check environment variables are set"
    echo "3. Verify database connection"
    echo "4. Check API keys are valid"
    exit 1
fi











