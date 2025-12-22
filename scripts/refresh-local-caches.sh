#!/bin/bash

# 🔄 Local Cache Refresh Helper Script
# This script manually refreshes all smart caches in local development
# Use this when caches go stale (older than 3 hours)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Smart Cache Manual Refresh for Development        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if server is running
echo -e "${YELLOW}⏳ Checking if development server is running...${NC}"
if ! curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Development server is not running at ${BASE_URL}${NC}"
    echo -e "${YELLOW}💡 Please start it with: npm run dev${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Function to call refresh endpoint
refresh_cache() {
    local name=$1
    local endpoint=$2
    
    echo -e "${BLUE}🔄 Refreshing ${name}...${NC}"
    
    response=$(curl -s -X POST "${BASE_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -w "\n%{http_code}")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✅ ${name} refreshed successfully${NC}"
        
        # Try to parse summary from response
        if command -v jq &> /dev/null; then
            success_count=$(echo "$body" | jq -r '.summary.successCount // 0' 2>/dev/null || echo "N/A")
            error_count=$(echo "$body" | jq -r '.summary.errorCount // 0' 2>/dev/null || echo "N/A")
            echo -e "   ${GREEN}→${NC} Success: ${success_count} | Errors: ${error_count}"
        fi
    else
        echo -e "${RED}❌ ${name} refresh failed (HTTP ${http_code})${NC}"
        if command -v jq &> /dev/null; then
            error_msg=$(echo "$body" | jq -r '.error // .message // "Unknown error"' 2>/dev/null || echo "Unknown error")
            echo -e "   ${RED}→${NC} Error: ${error_msg}"
        fi
    fi
    echo ""
}

# Option to refresh all or specific cache
if [ "$1" == "all" ] || [ -z "$1" ]; then
    echo -e "${YELLOW}📊 Refreshing ALL caches...${NC}"
    echo ""
    
    # Use unified refresh endpoint
    echo -e "${BLUE}🔄 Calling unified refresh endpoint...${NC}"
    
    response=$(curl -s -X POST "${BASE_URL}/api/automated/refresh-all-caches" \
        -H "Content-Type: application/json" \
        -w "\n%{http_code}")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✅ All caches refreshed successfully!${NC}"
        
        if command -v jq &> /dev/null; then
            echo ""
            echo -e "${BLUE}📊 Summary:${NC}"
            echo "$body" | jq -r '.summary' 2>/dev/null || echo "No summary available"
            echo ""
            echo -e "${BLUE}📋 Details:${NC}"
            echo "$body" | jq -r '.details' 2>/dev/null || echo "No details available"
        fi
    else
        echo -e "${RED}❌ Unified cache refresh failed (HTTP ${http_code})${NC}"
        if command -v jq &> /dev/null; then
            echo "$body" | jq -r '.error // .message // "Unknown error"' 2>/dev/null || echo "Unknown error"
        fi
    fi
    
elif [ "$1" == "meta-monthly" ]; then
    refresh_cache "Meta Monthly Cache" "/api/automated/refresh-current-month-cache"
    
elif [ "$1" == "meta-weekly" ]; then
    refresh_cache "Meta Weekly Cache" "/api/automated/refresh-current-week-cache"
    
elif [ "$1" == "google-monthly" ]; then
    refresh_cache "Google Ads Monthly Cache" "/api/automated/refresh-google-ads-current-month-cache"
    
elif [ "$1" == "google-weekly" ]; then
    refresh_cache "Google Ads Weekly Cache" "/api/automated/refresh-google-ads-current-week-cache"
    
else
    echo -e "${RED}❌ Unknown option: $1${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0                    # Refresh all caches (default)"
    echo "  $0 all                # Refresh all caches"
    echo "  $0 meta-monthly       # Refresh Meta monthly cache only"
    echo "  $0 meta-weekly        # Refresh Meta weekly cache only"
    echo "  $0 google-monthly     # Refresh Google Ads monthly cache only"
    echo "  $0 google-weekly      # Refresh Google Ads weekly cache only"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Cache refresh completed!${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: You can check cache status at:${NC}"
echo -e "   ${BLUE}${BASE_URL}/admin/cache-monitoring${NC}"
echo ""





