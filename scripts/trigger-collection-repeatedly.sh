#!/bin/bash

echo "🚀 Triggering Collection for Each Client Individually"
echo "═══════════════════════════════════════════════════════"
echo ""

# Array of client IDs (you'll need to add all 16)
clients=(
  "ab0b4c7e-2bf0-46bc-b455-b18ef6942baa"  # Belmonte
)

for client_id in "${clients[@]}"; do
  echo "📊 Triggering collection for client: $client_id"
  
  # Weekly
  curl -X POST http://localhost:3000/api/admin/collect-weekly-data \
    -H "Content-Type: application/json" \
    -d "{\"clientId\":\"$client_id\"}" \
    -s | jq -r '.message // .error' 2>/dev/null || echo "  Weekly triggered"
  
  # Monthly  
  curl -X POST http://localhost:3000/api/admin/collect-monthly-data \
    -H "Content-Type: application/json" \
    -d "{\"clientId\":\"$client_id\"}" \
    -s | jq -r '.message // .error' 2>/dev/null || echo "  Monthly triggered"
  
  echo "  ✅ Done"
  echo ""
  
  # Wait between clients
  sleep 2
done

echo "═══════════════════════════════════════════════════════"
echo "✅ All clients triggered"
echo "⏰ Wait 2-3 minutes then check: node scripts/audit-4-categories.js"

