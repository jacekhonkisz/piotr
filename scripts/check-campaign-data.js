const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCampaignData() {
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  const client = clients[0];
  console.log(`\n🔍 Checking campaign_data for: ${client.name}\n`);
  
  // Check one specific period in detail
  const { data: september, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('summary_date', '2025-09-01')
    .eq('summary_type', 'monthly')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!september || september.length === 0) {
    console.log('⚠️ No data found for September 2025');
    return;
  }
  
  const record = september[0];
  
  console.log('📊 SEPTEMBER 2025 RECORD:\n');
  console.log('Core Metrics:');
  console.log(`  • Total Spend: ${record.total_spend}`);
  console.log(`  • Total Impressions: ${record.total_impressions}`);
  console.log(`  • Total Clicks: ${record.total_clicks}`);
  console.log(`  • Total Conversions: ${record.total_conversions}`);
  console.log(`  • Active Campaigns: ${record.active_campaigns}`);
  console.log(`  • Total Campaigns: ${record.total_campaigns}`);
  
  console.log('\nCampaign Data (JSONB):');
  if (record.campaign_data) {
    console.log(`  • Type: ${typeof record.campaign_data}`);
    console.log(`  • Is Array: ${Array.isArray(record.campaign_data)}`);
    if (Array.isArray(record.campaign_data)) {
      console.log(`  • Length: ${record.campaign_data.length}`);
      if (record.campaign_data.length > 0) {
        console.log(`  • First campaign:`, JSON.stringify(record.campaign_data[0], null, 2));
      } else {
        console.log(`  • ❌ EMPTY ARRAY`);
      }
    } else {
      console.log(`  • Value:`, JSON.stringify(record.campaign_data, null, 2));
    }
  } else {
    console.log(`  • ❌ NULL or undefined`);
  }
  
  console.log('\nMeta Tables (JSONB):');
  if (record.meta_tables) {
    console.log(`  • Type: ${typeof record.meta_tables}`);
    const keys = Object.keys(record.meta_tables);
    console.log(`  • Keys: ${keys.join(', ')}`);
    keys.forEach(key => {
      const value = record.meta_tables[key];
      if (Array.isArray(value)) {
        console.log(`    - ${key}: ${value.length} items`);
      } else {
        console.log(`    - ${key}: ${typeof value}`);
      }
    });
  } else {
    console.log(`  • ❌ NULL or undefined`);
  }
  
  console.log('\nOther Fields:');
  console.log(`  • Platform: ${record.platform || 'not set'}`);
  console.log(`  • Data Source: ${record.data_source}`);
  console.log(`  • Last Updated: ${record.last_updated}`);
  
  // Check a few more records
  console.log('\n\n📊 CHECKING ALL RECORDS:\n');
  
  const { data: allRecords } = await supabase
    .from('campaign_summaries')
    .select('summary_date, summary_type, platform, total_campaigns, campaign_data, meta_tables')
    .eq('client_id', client.id)
    .order('summary_date', { ascending: false })
    .limit(10);
  
  console.log('┌────────────┬──────────┬──────────┬───────────────┬─────────────────┬─────────────┐');
  console.log('│ Date       │ Type     │ Platform │ Total Camps   │ campaign_data   │ meta_tables │');
  console.log('├────────────┼──────────┼──────────┼───────────────┼─────────────────┼─────────────┤');
  allRecords.forEach(r => {
    const hasData = r.campaign_data && Array.isArray(r.campaign_data) && r.campaign_data.length > 0;
    const hasMeta = r.meta_tables && Object.keys(r.meta_tables).length > 0;
    const dataStr = hasData ? `✅ ${r.campaign_data.length}` : '❌ empty';
    const metaStr = hasMeta ? '✅ yes' : '❌ no';
    console.log(`│ ${r.summary_date} │ ${r.summary_type.padEnd(8)} │ ${(r.platform || 'meta').padEnd(8)} │ ${String(r.total_campaigns).padStart(13)} │ ${dataStr.padEnd(15)} │ ${metaStr.padEnd(11)} │`);
  });
  console.log('└────────────┴──────────┴──────────┴───────────────┴─────────────────┴─────────────┘');
}

checkCampaignData().then(() => process.exit(0)).catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
