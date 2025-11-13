#!/bin/bash

# 🧪 Weekly Cache Endpoint Diagnostic Test
# This script tests if the weekly cache refresh endpoint is working

echo "========================================="
echo "🔍 WEEKLY CACHE ENDPOINT DIAGNOSTIC TEST"
echo "========================================="
echo ""

# Configuration
if [ -z "$1" ]; then
  echo "❌ Error: Please provide your domain as first argument"
  echo "Usage: ./test_weekly_cache_endpoint.sh yourdomain.vercel.app"
  exit 1
fi

DOMAIN=$1
ENDPOINT="https://${DOMAIN}/api/automated/refresh-current-week-cache"

echo "📍 Testing endpoint: $ENDPOINT"
echo ""

# Test 1: Check if endpoint is accessible
echo "TEST 1: Endpoint Accessibility"
echo "================================"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${ENDPOINT}")
echo "HTTP Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ Endpoint is accessible"
elif [ "$HTTP_CODE" == "401" ]; then
  echo "⚠️  Endpoint requires authentication (expected for cron)"
elif [ "$HTTP_CODE" == "404" ]; then
  echo "❌ Endpoint not found - deployment issue?"
else
  echo "⚠️  Unexpected status code: $HTTP_CODE"
fi
echo ""

# Test 2: Try POST request
echo "TEST 2: POST Request Test"
echo "================================"
echo "Attempting POST request..."
RESPONSE=$(curl -s -X POST "${ENDPOINT}" -H "Content-Type: application/json" -w "\nHTTP_CODE:%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "Response Code: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Test 3: Check response for success indicators
echo "TEST 3: Response Analysis"
echo "================================"
if echo "$BODY" | grep -q '"success":true'; then
  echo "✅ Response indicates success"
  
  # Extract statistics if available
  SUCCESS_COUNT=$(echo "$BODY" | jq -r '.summary.successCount // 0' 2>/dev/null)
  ERROR_COUNT=$(echo "$BODY" | jq -r '.summary.errorCount // 0' 2>/dev/null)
  SKIPPED_COUNT=$(echo "$BODY" | jq -r '.summary.skippedCount // 0' 2>/dev/null)
  TOTAL_CLIENTS=$(echo "$BODY" | jq -r '.summary.totalClients // 0' 2>/dev/null)
  
  echo "  - Total Clients: $TOTAL_CLIENTS"
  echo "  - Success: $SUCCESS_COUNT"
  echo "  - Errors: $ERROR_COUNT"
  echo "  - Skipped: $SKIPPED_COUNT"
  
  if [ "$SUCCESS_COUNT" -gt 0 ]; then
    echo ""
    echo "✅ GOOD: At least some clients were refreshed successfully"
  elif [ "$SKIPPED_COUNT" -gt 0 ]; then
    echo ""
    echo "⚠️  WARNING: All clients were skipped (cache might already be fresh)"
  else
    echo ""
    echo "❌ ISSUE: No successful refreshes"
  fi
elif echo "$BODY" | grep -q '"success":false'; then
  echo "❌ Response indicates failure"
  ERROR_MSG=$(echo "$BODY" | jq -r '.error // .details // "Unknown error"' 2>/dev/null)
  echo "  Error: $ERROR_MSG"
else
  echo "⚠️  Could not determine success status from response"
fi
echo ""

# Test 4: Check timing
echo "TEST 4: Timing Analysis"
echo "================================"
CURRENT_TIME=$(date +"%Y-%m-%d %H:%M:%S")
CURRENT_MINUTE=$(date +"%M")
echo "Current time: $CURRENT_TIME"
echo "Current minute: $CURRENT_MINUTE"
echo ""
echo "Cron schedule: 10 */3 * * * (every 3 hours at :10)"
echo "Next expected run times:"
for hour in 01 04 07 10 13 16 19 22; do
  echo "  - Today at ${hour}:10"
done
echo ""

# Summary
echo "========================================="
echo "📊 DIAGNOSTIC SUMMARY"
echo "========================================="
echo ""
echo "Endpoint Status:"
if [ "$HTTP_CODE" == "200" ]; then
  echo "  ✅ Endpoint responding correctly"
elif [ "$HTTP_CODE" == "401" ]; then
  echo "  ⚠️  Endpoint requires authentication (normal for cron)"
  echo "      Check if Vercel cron has correct credentials"
else
  echo "  ❌ Endpoint issue detected (HTTP $HTTP_CODE)"
fi
echo ""

echo "Cache Refresh Status:"
if echo "$BODY" | grep -q '"success":true' && [ "$SUCCESS_COUNT" -gt 0 ]; then
  echo "  ✅ Cache refresh working when triggered manually"
  echo "  🔍 Issue is likely with Vercel cron not executing"
  echo ""
  echo "ACTION REQUIRED:"
  echo "  1. Check Vercel Dashboard → Logs"
  echo "  2. Verify cron jobs are enabled"
  echo "  3. Look for cron execution logs at :10 of every 3rd hour"
elif echo "$BODY" | grep -q '"success":true' && [ "$SKIPPED_COUNT" -gt 0 ]; then
  echo "  ⚠️  All clients skipped (cache already fresh)"
  echo "  🔍 This might mean cron IS working, but cache freshness"
  echo "      calculation is different from monitoring dashboard"
  echo ""
  echo "ACTION REQUIRED:"
  echo "  1. Run audit_weekly_cache_issue.sql to check database state"
  echo "  2. Compare cache age calculation in cron vs monitoring"
else
  echo "  ❌ Cache refresh failing"
  echo "  🔍 Issue with endpoint implementation or configuration"
  echo ""
  echo "ACTION REQUIRED:"
  echo "  1. Check application logs for errors"
  echo "  2. Verify database connection"
  echo "  3. Check API tokens are valid"
fi
echo ""

echo "========================================="
echo "✅ DIAGNOSTIC TEST COMPLETE"
echo "========================================="
echo ""
echo "For more details, run:"
echo "  - psql < audit_weekly_cache_issue.sql"
echo "  - Check Vercel logs at https://vercel.com/dashboard"

