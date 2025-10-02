const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStoredPeriods() {
  // Get Belmonte client
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
    .select('period_start, period_end, summary_type, platform, campaigns, total_spend')
    .eq('client_id', client.id)
    .order('period_start', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${summaries?.length || 0} stored periods in campaign_summaries:\n`);
  
  if (summaries && summaries.length > 0) {
    console.log('┌────────────────────────────┬──────────┬──────────┬─────────────┬───────────┐');
    console.log('│ Period                     │ Type     │ Platform │ Campaigns   │ Spend     │');
    console.log('├────────────────────────────┼──────────┼──────────┼─────────────┼───────────┤');
    summaries.forEach(s => {
      const campaignCount = s.campaigns?.length || 0;
      const spend = (s.total_spend || 0).toFixed(2);
      console.log(`│ ${s.period_start} to ${s.period_end} │ ${s.summary_type.padEnd(8)} │ ${s.platform.padEnd(8)} │ ${String(campaignCount).padStart(11)} │ ${spend.padStart(9)} │`);
    });
    console.log('└────────────────────────────┴──────────┴──────────┴─────────────┴───────────┘');
  } else {
    console.log('⚠️ NO DATA STORED IN campaign_summaries!');
  }
  
  // Check daily_kpi_data
  const { data: dailyData } = await supabase
    .from('daily_kpi_data')
    .select('date, platform, total_spend')
    .eq('client_id', client.id)
    .order('date', { ascending: false })
    .limit(10);
  
  console.log(`\n📊 Recent daily_kpi_data entries (last 10):\n`);
  
  if (dailyData && dailyData.length > 0) {
    console.log('┌────────────┬──────────┬───────────┐');
    console.log('│ Date       │ Platform │ Spend     │');
    console.log('├────────────┼──────────┼───────────┤');
    dailyData.forEach(d => {
      const spend = (d.total_spend || 0).toFixed(2);
      console.log(`│ ${d.date}│ ${d.platform.padEnd(8)} │ ${spend.padStart(9)} │`);
    });
    console.log('└────────────┴──────────┴───────────┘');
  } else {
    console.log('⚠️ NO DATA in daily_kpi_data!');
  }
}

checkStoredPeriods().then(() => process.exit(0)).catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
