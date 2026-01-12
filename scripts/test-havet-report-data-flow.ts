#!/usr/bin/env tsx
/**
 * Test the data flow from database to UI format for Havet
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Testing Havet data flow from database to UI format');
  console.log('='.repeat(80));
  
  // Get Havet client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('name', 'Havet')
    .single();
  
  if (!client) {
    console.error('❌ Client not found');
    return;
  }
  
  console.log(`✅ Client: ${client.name} (${client.id})`);
  console.log('');
  
  // Simulate what StandardizedDataFetcher does
  const { data: summaries } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('platform', 'google')
    .eq('summary_type', 'monthly')
    .in('summary_date', ['2025-11-01', '2025-12-01'])
    .order('summary_date', { ascending: false });
  
  if (!summaries || summaries.length === 0) {
    console.error('❌ No summaries found');
    return;
  }
  
  console.log(`📊 Found ${summaries.length} monthly summaries`);
  console.log('');
  
  summaries.forEach(summary => {
    const reservationValue = parseFloat(summary.reservation_value || '0') || 0;
    const date = new Date(summary.summary_date).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
    
    console.log(`📅 ${date}:`);
    console.log(`   Database reservation_value: ${reservationValue.toFixed(2)} PLN`);
    console.log(`   Should map to conversionMetrics.total_conversion_value: ${reservationValue.toFixed(2)} PLN`);
    console.log(`   UI should display: ${reservationValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`);
    console.log('');
  });
  
  console.log('✅ Data flow check complete!');
  console.log('');
  console.log('💡 If reports still show 0, try:');
  console.log('   1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)');
  console.log('   2. Clear browser cache');
  console.log('   3. Check browser console for errors');
}

main().catch(console.error);

