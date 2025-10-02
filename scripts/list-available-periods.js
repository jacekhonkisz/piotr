const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listPeriods() {
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  const client = clients[0];
  console.log(`\n🔍 Available periods for: ${client.name}\n`);
  
  // Get all monthly periods
  const { data: months } = await supabase
    .from('campaign_summaries')
    .select('summary_date, platform, total_campaigns')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .order('summary_date', { ascending: false });
  
  console.log('📅 MONTHLY PERIODS (Meta):');
  months.filter(m => m.platform === 'meta').slice(0, 13).forEach((m, i) => {
    console.log(`  ${i+1}. ${m.summary_date} (${m.total_campaigns} campaigns)`);
  });
  
  // Get all weekly periods
  const { data: weeks } = await supabase
    .from('campaign_summaries')
    .select('summary_date, platform, total_campaigns')
    .eq('client_id', client.id)
    .eq('summary_type', 'weekly')
    .order('summary_date', { ascending: false });
  
  console.log('\n📅 WEEKLY PERIODS (Meta):');
  weeks.filter(w => w.platform === 'meta').slice(0, 10).forEach((w, i) => {
    console.log(`  ${i+1}. ${w.summary_date} (${w.total_campaigns} campaigns)`);
  });
}

listPeriods().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
