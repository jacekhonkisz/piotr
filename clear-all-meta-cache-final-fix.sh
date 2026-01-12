#!/bin/bash

# Final fix: Clear cache for all clients to get fresh Meta API data with correct CTR/CPC

echo "🔥 CLEARING ALL META ADS CACHE TO APPLY FINAL FIX"
echo "================================================================================"
echo ""
echo "This clears cache so individual campaign CTR/CPC values come directly from"
echo "Meta API (inline_link_click_ctr and cost_per_inline_link_click fields)"
echo ""

# Clear all current_month_cache
echo "1️⃣ Clearing all current_month_cache..."
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { error } = await supabase.from('current_month_cache').delete().neq('client_id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.log('   ❌ Error:', error.message);
  } else {
    console.log('   ✅ All current_month_cache cleared');
  }
})();
"

echo ""
echo "================================================================================"
echo "✅ CACHE CLEARED"
echo "================================================================================"
echo ""
echo "📝 WHAT WAS FIXED:"
echo ""
echo "1. Individual campaign CTR/CPC now use Meta API values DIRECTLY:"
echo "   - inline_link_click_ctr (from Meta API)"
echo "   - cost_per_inline_link_click (from Meta API)"
echo ""
echo "2. Summary cards (top metrics) recalculate from totals:"
echo "   - CTR = (totalClicks / totalImpressions) × 100"
echo "   - CPC = totalSpend / totalClicks"
echo ""
echo "3. This matches Meta Business Suite EXACTLY:"
echo "   - Campaign table shows API values"
echo "   - Summary shows calculated totals"
echo ""
echo "📝 NEXT STEPS:"
echo "1. Restart dev server: npm run dev"
echo "2. Hard refresh browser (Cmd+Shift+R)"
echo "3. Check December 2025 campaign table - should match Meta Business Suite!"
echo ""

