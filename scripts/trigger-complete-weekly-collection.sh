#!/bin/bash

# Trigger complete weekly collection with new parsing logic
# This will re-collect ALL missing weeks with COMPLETE conversion metrics

echo "🚀 Triggering complete weekly collection with parsed conversion metrics..."
echo ""

# Load CRON_SECRET from .env.local
if [ -f .env.local ]; then
  export $(cat .env.local | grep CRON_SECRET | xargs)
fi

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET not found in .env.local"
  echo "Please set CRON_SECRET environment variable"
  exit 1
fi

echo "✅ CRON_SECRET loaded"
echo ""

# Trigger the collection
echo "📡 Calling incremental-weekly-collection endpoint..."
echo "⏱️  This may take 2-3 minutes..."
echo ""

curl -X GET "https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -w "\n\n⏱️  Response time: %{time_total}s\n" \
  -s | jq '.' || echo "(Response might not be JSON)"

echo ""
echo "✅ Collection triggered!"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for collection to complete"
echo "2. Refresh your dashboard"
echo "3. Check Week 46 and other weeks for complete funnel metrics"
echo "4. Verify booking_step_1/2/3, reservations, and ROAS are populated"

