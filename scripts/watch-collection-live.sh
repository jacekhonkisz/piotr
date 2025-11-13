#!/bin/bash

echo "🔍 LIVE COLLECTION MONITOR"
echo "═══════════════════════════════════════════════════════════"
echo ""

while true; do
  clear
  echo "🔍 LIVE COLLECTION MONITOR - $(date +%H:%M:%S)"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  
  echo "📊 CLIENTS PROCESSED:"
  cat /tmp/next-server.log | grep "Completed client" | tail -10
  echo ""
  
  echo "🔄 CURRENT CLIENT:"
  cat /tmp/next-server.log | grep "Processing client" | tail -1
  echo ""
  
  echo "📈 TOTAL COMPLETED:"
  COMPLETED=$(cat /tmp/next-server.log | grep -c "Completed client")
  echo "   $COMPLETED / 16 clients"
  echo ""
  
  echo "💾 DATABASE RECORDS:"
  node -e "
    const { createClient } = require('@supabase/supabase-js');
    require('dotenv').config();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    (async () => {
      // Use count query to bypass 1000 limit
      const { count: total } = await supabase
        .from('campaign_summaries')
        .select('*', { count: 'exact', head: true });
      console.log(\`   Total records: \${total} (was 1290)\`);
      if (total > 1290) {
        console.log(\`   ✅ +\${total - 1290} new records since fix!\`);
      }
    })();
  " 2>/dev/null
  
  echo ""
  echo "Press Ctrl+C to stop monitoring"
  echo "Refreshing in 10 seconds..."
  
  sleep 10
done

