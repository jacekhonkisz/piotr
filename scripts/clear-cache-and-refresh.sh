#!/bin/bash

# Clear Google Ads Cache and Trigger Refresh
# Usage: ./scripts/clear-cache-and-refresh.sh [CLIENT_ID]

CLIENT_ID=${1:-""}
BASE_URL=${NEXT_PUBLIC_APP_URL:-"http://localhost:3000"}

echo "🗑️ Clearing Google Ads cache..."
echo "📅 Base URL: $BASE_URL"
if [ -n "$CLIENT_ID" ]; then
  echo "👤 Client ID: $CLIENT_ID"
fi
echo ""

# Clear cache
CLEAR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/clear-google-ads-cache" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2)" \
  -d "{\"clientId\": \"$CLIENT_ID\"}")

echo "📊 Clear Cache Response:"
echo "$CLEAR_RESPONSE" | jq '.' 2>/dev/null || echo "$CLEAR_RESPONSE"
echo ""

# If you want to trigger a refresh, uncomment below:
# echo "🔄 Triggering refresh..."
# REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/cache-monitoring/refresh-all" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2)")
# 
# echo "📊 Refresh Response:"
# echo "$REFRESH_RESPONSE" | jq '.' 2>/dev/null || echo "$REFRESH_RESPONSE"

echo ""
echo "✅ Done! Now refresh your dashboard to see fresh data."

