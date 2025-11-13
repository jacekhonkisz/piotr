#!/bin/bash

# 🧪 Test Your Meta Token
# This will test if the token is valid and which ad accounts it has access to

TOKEN="EAAlDmWD3W2IBPRpaBVJS9ctA1tkp93AQ4dI4Kgfmh72mdSPejk16MZAact3mT1Jv1MnyMwSDVPMRCpFC9ZBxxZBnsXG58TWATuglIrFxML71FTZB0fw3ITZBCZBvTCYsv6ZAs58YKnnIH6tfZAfviFhPfOZBxGwWVIr7F2guVVoCkQZBLeguOdHZBX83oha5s0hGb9xbcXG"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🧪 Testing Meta API Token"
echo "=========================================="
echo ""
echo "Token: ${TOKEN:0:30}..."
echo ""

# Test 1: Is token valid at all?
echo "📋 Test 1: Token Validity Check"
echo "Testing /me endpoint..."
echo ""

RESPONSE=$(curl -s "https://graph.facebook.com/v18.0/me?access_token=${TOKEN}")

if echo "$RESPONSE" | grep -q '"id"'; then
  NAME=$(echo "$RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo -e "${GREEN}✅ TOKEN IS VALID!${NC}"
  echo "   System User: $NAME (ID: $ID)"
  echo ""
else
  ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  echo -e "${RED}❌ TOKEN IS INVALID!${NC}"
  echo "   Error: $ERROR"
  echo ""
  echo "You need to generate a new token in Meta Business Manager."
  exit 1
fi

# Test 2: Check ad accounts
echo "=========================================="
echo "📋 Test 2: Ad Account Access"
echo "Testing access to your ad accounts..."
echo ""

# Add your ad account IDs here (run get_ad_account_ids.sql to get these)
# Format: "Client Name|ad_account_id_without_act_prefix"

# YOU NEED TO FILL THIS ARRAY WITH YOUR AD ACCOUNT IDs!
# Run: get_ad_account_ids.sql
# Then copy the clean_ad_account_id values here

declare -a ACCOUNTS=(
  "Apartamenty Lambert|YOUR_AD_ACCOUNT_ID_1"
  "Belmonte Hotel|YOUR_AD_ACCOUNT_ID_2"
  "Hotel Lambert|YOUR_AD_ACCOUNT_ID_3"
  # Add all 16 here...
)

SUCCESS=0
FAIL=0
FAILED_ACCOUNTS=()

for account in "${ACCOUNTS[@]}"; do
  if [ "$account" = "Apartamenty Lambert|YOUR_AD_ACCOUNT_ID_1" ]; then
    echo -e "${YELLOW}⚠️  Please update the ACCOUNTS array in this script!${NC}"
    echo ""
    echo "Steps:"
    echo "1. Run: get_ad_account_ids.sql"
    echo "2. Copy the ad account IDs from the output"
    echo "3. Edit this script and replace the ACCOUNTS array"
    echo "4. Run this script again"
    exit 1
  fi
  
  IFS='|' read -r name account_id <<< "$account"
  
  RESPONSE=$(curl -s "https://graph.facebook.com/v18.0/act_${account_id}?fields=id,name,account_status&access_token=${TOKEN}")
  
  if echo "$RESPONSE" | grep -q '"id"'; then
    ACCOUNT_NAME=$(echo "$RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅${NC} $name - ${GREEN}HAS PERMISSION${NC}"
    ((SUCCESS++))
  else
    ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    echo -e "${RED}❌${NC} $name - ${RED}NO PERMISSION${NC}"
    echo "   Error: $ERROR"
    FAILED_ACCOUNTS+=("$name")
    ((FAIL++))
  fi
done

echo ""
echo "=========================================="
echo "📊 SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ Success: $SUCCESS${NC}"
echo -e "${RED}❌ Failed: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${YELLOW}⚠️  These accounts need permissions:${NC}"
  for account in "${FAILED_ACCOUNTS[@]}"; do
    echo "   • $account"
  done
  echo ""
  echo "🛠️  TO FIX:"
  echo "1. Go to Meta Business Manager (business.facebook.com)"
  echo "2. Business Settings → Users → System Users"
  echo "3. Find your system user (the one with this token)"
  echo "4. Add the failed ad accounts above"
  echo "5. Grant 'ads_read' permission"
  echo "6. Re-run this test"
else
  echo -e "${GREEN}🎉 Perfect! All accounts have proper permissions!${NC}"
fi

