/**
 * DELETE TEST CLIENTS
 * 
 * Removes non-real clients and all their associated data.
 * 
 * Run with: npx tsx scripts/delete-test-clients.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Clients to delete (test/non-real clients)
const CLIENTS_TO_DELETE = [
  'jacek',
  'Blue & Green Baltic Kołobrzeg',
  'Blue & Green Mazury'
];

async function deleteTestClients() {
  console.log('🗑️  DELETE TEST CLIENTS');
  console.log('='.repeat(60));
  console.log(`\n📋 Clients to delete: ${CLIENTS_TO_DELETE.join(', ')}\n`);

  for (const clientName of CLIENTS_TO_DELETE) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`🔍 Processing: ${clientName}`);
    
    // Find client ID
    const { data: client, error: findError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('name', clientName)
      .single();
    
    if (findError || !client) {
      console.log(`   ⚠️ Client not found: ${clientName}`);
      continue;
    }
    
    console.log(`   📌 Found client ID: ${client.id}`);
    
    // Delete from campaign_summaries
    const { error: summariesError, count: summariesCount } = await supabase
      .from('campaign_summaries')
      .delete({ count: 'exact' })
      .eq('client_id', client.id);
    
    if (summariesError) {
      console.log(`   ❌ Error deleting campaign_summaries: ${summariesError.message}`);
    } else {
      console.log(`   ✅ Deleted ${summariesCount || 0} campaign_summaries records`);
    }
    
    // Delete from daily_kpi_data
    const { error: kpiError, count: kpiCount } = await supabase
      .from('daily_kpi_data')
      .delete({ count: 'exact' })
      .eq('client_id', client.id);
    
    if (kpiError) {
      console.log(`   ❌ Error deleting daily_kpi_data: ${kpiError.message}`);
    } else {
      console.log(`   ✅ Deleted ${kpiCount || 0} daily_kpi_data records`);
    }
    
    // Delete from current_month_cache
    const { error: monthCacheError, count: monthCacheCount } = await supabase
      .from('current_month_cache')
      .delete({ count: 'exact' })
      .eq('client_id', client.id);
    
    if (monthCacheError) {
      console.log(`   ❌ Error deleting current_month_cache: ${monthCacheError.message}`);
    } else {
      console.log(`   ✅ Deleted ${monthCacheCount || 0} current_month_cache records`);
    }
    
    // Delete from current_week_cache
    const { error: weekCacheError, count: weekCacheCount } = await supabase
      .from('current_week_cache')
      .delete({ count: 'exact' })
      .eq('client_id', client.id);
    
    if (weekCacheError) {
      console.log(`   ❌ Error deleting current_week_cache: ${weekCacheError.message}`);
    } else {
      console.log(`   ✅ Deleted ${weekCacheCount || 0} current_week_cache records`);
    }
    
    // Delete from campaigns table
    const { error: campaignsError, count: campaignsCount } = await supabase
      .from('campaigns')
      .delete({ count: 'exact' })
      .eq('client_id', client.id);
    
    if (campaignsError) {
      console.log(`   ❌ Error deleting campaigns: ${campaignsError.message}`);
    } else {
      console.log(`   ✅ Deleted ${campaignsCount || 0} campaigns records`);
    }
    
    // Delete from executive_summaries
    const { error: execError, count: execCount } = await supabase
      .from('executive_summaries')
      .delete({ count: 'exact' })
      .eq('client_id', client.id);
    
    if (execError) {
      console.log(`   ❌ Error deleting executive_summaries: ${execError.message}`);
    } else {
      console.log(`   ✅ Deleted ${execCount || 0} executive_summaries records`);
    }
    
    // Finally, delete the client record itself
    const { error: clientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id);
    
    if (clientError) {
      console.log(`   ❌ Error deleting client: ${clientError.message}`);
    } else {
      console.log(`   ✅ Deleted client record: ${clientName}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 Done!');
  
  // Show remaining clients
  const { data: remainingClients } = await supabase
    .from('clients')
    .select('name')
    .order('name');
  
  console.log(`\n📊 Remaining clients (${remainingClients?.length || 0}):`);
  remainingClients?.forEach(c => console.log(`   - ${c.name}`));
}

deleteTestClients()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('🔥 Fatal error:', error);
    process.exit(1);
  });

