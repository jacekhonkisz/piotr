#!/bin/bash

# Post-Run Verification Script
# Run this AFTER live mode completes to verify all data was stored

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 VERIFYING DATA STORAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load environment
export $(cat .env.local | grep -v '^#' | xargs)

# Create verification queries
cat > /tmp/verify-google-ads-storage.sql << 'EOF'
-- 1. Total Google Ads records
SELECT COUNT(*) as total_records
FROM campaign_summaries
WHERE platform = 'google';

-- 2. Monthly records
SELECT COUNT(*) as monthly_records
FROM campaign_summaries
WHERE platform = 'google' 
AND summary_type = 'monthly';

-- 3. Weekly records
SELECT COUNT(*) as weekly_records
FROM campaign_summaries
WHERE platform = 'google' 
AND summary_type = 'weekly';

-- 4. Records per client
SELECT 
  c.name,
  COUNT(*) FILTER (WHERE cs.summary_type = 'monthly') as monthly,
  COUNT(*) FILTER (WHERE cs.summary_type = 'weekly') as weekly,
  COUNT(*) as total
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.platform = 'google'
GROUP BY c.name
ORDER BY c.name;

-- 5. Havet November 2025
SELECT 
  'Havet November 2025' as check_name,
  COUNT(*) as found,
  MAX(total_spend) as spend,
  MAX(total_conversions) as conversions,
  MAX(reservations) as reservations
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Havet'
AND cs.summary_type = 'monthly'
AND cs.summary_date = '2025-11-01'
AND cs.platform = 'google';
EOF

echo "📊 Running verification queries..."
echo ""

# Note: You'll need to run these queries in Supabase SQL Editor
# or use psql if you have direct database access

echo "✅ Verification SQL created at: /tmp/verify-google-ads-storage.sql"
echo ""
echo "📋 Expected Results:"
echo "   - Total records: 780"
echo "   - Monthly records: 144"
echo "   - Weekly records: 636"
echo "   - Per client: 65 records (12 monthly + 53 weekly)"
echo "   - Havet November 2025: 1 record with complete data"
echo ""
echo "🔗 To verify:"
echo "   1. Open Supabase SQL Editor"
echo "   2. Paste queries from /tmp/verify-google-ads-storage.sql"
echo "   3. Compare results with expected values above"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

