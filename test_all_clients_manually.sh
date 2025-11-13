#!/bin/bash

# 🧪 Manual Client Token Testing Script
# 
# This script tests the Meta API token against all your client ad accounts
# to see which ones have permission and which don't.
#
# Usage:
#   1. Get your token from database (run: SELECT system_user_token FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1;)
#   2. Replace TOKEN below
#   3. Run: bash test_all_clients_manually.sh

# ============================================================================
# CONFIGURATION
# ============================================================================

# ⚠️ REPLACE THIS WITH YOUR ACTUAL TOKEN FROM DATABASE
TOKEN="YOUR_TOKEN_HERE"

# Meta API version
API_VERSION="v18.0"
BASE_URL="https://graph.facebook.com/${API_VERSION}"

# ============================================================================
# CLIENT AD ACCOUNTS (from your database)
# ============================================================================

# Format: "Client Name|ad_account_id"
declare -a CLIENTS=(
  "Hotel Lambert Ustronie Morskie|act_123456789"
  "Sandra SPA Karpacz|act_987654321"
  "Apartamenty Lambert|act_555666777"
  "jacek|act_111222333"
  "Hotel Diva SPA Kołobrzeg|act_444555666"
  "Hotel Artis Loft|act_777888999"
  "Belmonte Hotel|act_321654987"
  "Blue & Green Mazury|act_159753486"
  "Cesarskie Ogrody|act_246813579"
  "Havet|act_369258147"
  "Nickel Resort Grzybowo|act_147258369"
  "Arche Dwór Uphagena Gdańsk|act_753951456"
  "Blue & Green Baltic Kołobrzeg|act_852963741"
  "Hotel Zalewski Mrzeżyno|act_951357852"
  "Hotel Tobaco Łódź|act_357159753"
  "Hotel Diva SPA Kołobrzeg2|act_258456789"
)

# ============================================================================
# TESTING FUNCTIONS
# ============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

test_account() {
  local name=$1
  local account_id=$2
  
  # Remove 'act_' prefix if present
  local clean_id=${account_id#act_}
  
  # Make API request
  local response=$(curl -s "${BASE_URL}/act_${clean_id}?fields=id,name,account_status,currency&access_token=${TOKEN}")
  
  # Check if successful
  if echo "$response" | grep -q '"id"'; then
    local account_name=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ SUCCESS${NC} - $name"
    echo "   Account: $account_name (ID: act_${clean_id})"
    return 0
  else
    local error_msg=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    local error_code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
    echo -e "${RED}❌ FAILED${NC} - $name"
    echo "   Error: $error_msg (Code: $error_code)"
    echo "   Account ID: act_${clean_id}"
    return 1
  fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

echo "🧪 Testing Meta API Token Against All Client Ad Accounts"
echo "=========================================================="
echo ""

# Check if token is set
if [ "$TOKEN" = "YOUR_TOKEN_HERE" ]; then
  echo -e "${RED}❌ ERROR: Please set the TOKEN variable first!${NC}"
  echo ""
  echo "Steps:"
  echo "1. Run this SQL query to get your token:"
  echo "   SELECT system_user_token FROM clients WHERE system_user_token IS NOT NULL LIMIT 1;"
  echo ""
  echo "2. Copy the token value"
  echo "3. Edit this script and replace TOKEN=\"YOUR_TOKEN_HERE\""
  echo "4. Run: bash test_all_clients_manually.sh"
  exit 1
fi

echo "Token: ${TOKEN:0:30}..."
echo ""
echo "Testing ${#CLIENTS[@]} clients..."
echo ""

# Track results
success_count=0
fail_count=0
failed_clients=()

# Test each client
for client_info in "${CLIENTS[@]}"; do
  IFS='|' read -r name account_id <<< "$client_info"
  
  if test_account "$name" "$account_id"; then
    ((success_count++))
  else
    ((fail_count++))
    failed_clients+=("$name")
  fi
  echo ""
done

# ============================================================================
# SUMMARY
# ============================================================================

echo "=========================================================="
echo "📊 SUMMARY"
echo "=========================================================="
echo ""
echo -e "${GREEN}✅ Successful: $success_count / ${#CLIENTS[@]}${NC}"
echo -e "${RED}❌ Failed: $fail_count / ${#CLIENTS[@]}${NC}"
echo ""

if [ $fail_count -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Failed Clients:${NC}"
  for client in "${failed_clients[@]}"; do
    echo "   • $client"
  done
  echo ""
  
  echo "=========================================================="
  echo "🔍 DIAGNOSIS"
  echo "=========================================================="
  echo ""
  echo "The token is working, but lacks permissions for $fail_count ad accounts."
  echo ""
  echo "📋 TO FIX:"
  echo "1. Go to Meta Business Manager (business.facebook.com)"
  echo "2. Navigate to: Business Settings → Users → System Users"
  echo "3. Click on your system user"
  echo "4. View 'Assigned Assets' → Ad Accounts"
  echo "5. Add the missing ad accounts from the failed list above"
  echo "6. Grant 'ads_read' permission"
  echo "7. Re-run this test to verify"
  echo ""
else
  echo -e "${GREEN}🎉 Perfect! All clients have proper permissions!${NC}"
  echo ""
  echo "You can now test in the monitoring dashboard - all should show GREEN!"
fi

