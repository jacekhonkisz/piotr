#!/bin/bash

# Live monitoring of collection progress

echo "🔄 LIVE COLLECTION MONITORING"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
  clear
  echo "🔄 LIVE COLLECTION MONITORING - $(date '+%H:%M:%S')"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  
  node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function monitor() {
  const { data: clients } = await supabase.from('clients').select('id, name, google_ads_customer_id');
  
  let totalRecords = 0;
  let completeClients = 0;
  let googleNeeded = 0;
  
  for (const client of clients) {
    const batch1 = await supabase.from('campaign_summaries').select('platform, summary_type').eq('client_id', client.id).range(0, 999);
    const batch2 = await supabase.from('campaign_summaries').select('platform, summary_type').eq('client_id', client.id).range(1000, 1999);
    const records = [...batch1.data, ...batch2.data];
    
    const metaW = records.filter(r => r.platform === 'meta' && r.summary_type === 'weekly').length;
    const googleW = records.filter(r => r.platform === 'google' && r.summary_type === 'weekly').length;
    
    const hasGoogle = client.google_ads_customer_id ? 'Yes' : 'No';
    const expectedGoogleW = hasGoogle === 'Yes' ? 53 : 0;
    
    const isComplete = googleW >= expectedGoogleW;
    const status = isComplete ? '✅' : \`⏳ \${googleW}/53\`;
    
    totalRecords += records.length;
    if (isComplete) completeClients++;
    if (hasGoogle === 'Yes') googleNeeded += Math.max(0, 53 - googleW);
    
    if (!isComplete && hasGoogle === 'Yes') {
      console.log(\`\${status.padEnd(12)} \${client.name}\`);
    }
  }
  
  console.log('');
  console.log('═'.repeat(65));
  console.log(\`Total: \${totalRecords} / 1950 records (\${Math.round(totalRecords/1950*100)}%)\`);
  console.log(\`Complete: \${completeClients} / \${clients.length} clients\`);
  console.log(\`Remaining: \${googleNeeded} Google weekly records\`);
  console.log('═'.repeat(65));
}

monitor().catch(console.error);" 2>/dev/null

  echo ""
  echo "Next update in 15 seconds..."
  sleep 15
done




