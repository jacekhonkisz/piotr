const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStoredPeriods() {
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  const client = clients[0];
  console.log(`\n🔍 Checking stored periods for: ${client.name}\n`);
  
  // Check campaign_summaries
  const { data: summaries, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .order('summary_date', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${summaries?.length || 0} stored periods in campaign_summaries:\n`);
  
  if (summaries && summaries.length > 0) {
    summaries.forEach(s => {
      console.log(`- ${s.summary_type.padEnd(7)} | ${s.summary_date} | Platform: ${s.platform || 'meta'} | Campaigns: ${s.campaigns?.length || 0} | Spend: ${(s.total_spend || 0).toFixed(2)}`);
    });
  } else {
    console.log('⚠️ NO DATA STORED IN campaign_summaries!');
  }
}

checkStoredPeriods().then(() => process.exit(0)).catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
