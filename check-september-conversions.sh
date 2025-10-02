#!/bin/bash

# ============================================================================
# Check September Conversion Data
# ============================================================================
# This will show you exactly what conversion metrics exist for September
# ============================================================================

echo "🔍 Checking September conversion data..."
echo ""

echo "📊 Step 1: Checking API response..."
curl -s 'http://localhost:3000/api/fetch-live-data' -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "8657100a-6e87-422c-97f4-b733754a9ff8",
    "startDate": "2025-09-01",
    "endDate": "2025-09-30",
    "platform": "meta"
  }' | jq '{
    source: .debug.source,
    campaigns_count: (.data.campaigns | length),
    total_spend: .data.stats.totalSpend,
    conversion_metrics: {
      summary_reservations: .data.conversionMetrics.reservations,
      summary_reservation_value: .data.conversionMetrics.reservation_value,
      summary_booking_step_1: .data.conversionMetrics.booking_step_1,
      summary_roas: .data.conversionMetrics.roas
    },
    first_campaign_conversions: {
      name: .data.campaigns[0].campaign_name,
      spend: .data.campaigns[0].spend,
      reservations: .data.campaigns[0].reservations,
      reservation_value: .data.campaigns[0].reservation_value,
      booking_step_1: .data.campaigns[0].booking_step_1,
      roas: .data.campaigns[0].roas
    },
    all_campaigns_with_conversions: [
      .data.campaigns[] | 
      select(.reservations > 0 or .booking_step_1 > 0) | 
      {
        name: .campaign_name,
        reservations: .reservations,
        booking_step_1: .booking_step_1,
        reservation_value: .reservation_value
      }
    ]
  }'

echo ""
echo ""
echo "✅ Analysis:"
echo "  - If conversion_metrics shows non-zero → Data exists in summary"
echo "  - If first_campaign_conversions shows non-zero → Data exists in campaigns"
echo "  - If all_campaigns_with_conversions is empty [] → NO conversions tracked"
echo ""
echo "💡 Interpretation:"
echo "  - All zeros + empty array = Client had no conversions (NORMAL)"
echo "  - Campaigns have data but summary zeros = Aggregation bug (NEEDS FIX)"
echo "  - All NULL/undefined = Fields missing (NEEDS FIX)"

