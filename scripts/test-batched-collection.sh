#!/bin/bash

# ============================================================================
# Test Script: Batched Daily KPI Collection
# ============================================================================
# Purpose: Manually test the new batched collection endpoint
# Run: chmod +x test-batched-collection.sh && ./test-batched-collection.sh
# ============================================================================

echo "🧪 Testing Batched Daily KPI Collection"
echo "========================================"
echo ""

# Get CRON_SECRET
if [ -f "🔐_NEW_CRON_SECRET.txt" ]; then
    CRON_SECRET=$(cat 🔐_NEW_CRON_SECRET.txt)
    echo "✅ Found CRON_SECRET"
else
    echo "❌ CRON_SECRET file not found!"
    echo "Please create 🔐_NEW_CRON_SECRET.txt with your cron secret"
    exit 1
fi

# Get domain (you need to update this)
read -p "Enter your Vercel domain (e.g., your-app.vercel.app): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain is required!"
    exit 1
fi

echo ""
echo "🌐 Testing domain: https://$DOMAIN"
echo ""

# Test each batch
echo "📦 Testing Batch 1 (clients 0-4)..."
curl -X POST "https://$DOMAIN/api/automated/daily-kpi-collection-batched?offset=0&limit=5" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --silent | jq '.'

echo ""
echo "⏱️ Waiting 3 seconds..."
sleep 3

echo ""
echo "📦 Testing Batch 2 (clients 5-9)..."
curl -X POST "https://$DOMAIN/api/automated/daily-kpi-collection-batched?offset=5&limit=5" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --silent | jq '.'

echo ""
echo "✅ Testing complete!"
echo ""
echo "Next steps:"
echo "1. Check the JSON responses above"
echo "2. Verify 'success: true' in both responses"
echo "3. Check database: SELECT COUNT(*) FROM daily_kpi_data WHERE created_at >= CURRENT_DATE"
echo ""



