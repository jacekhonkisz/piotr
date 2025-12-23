#!/usr/bin/env node
/**
 * Debug all Havet periods to find which one has 363 booking_step_1 and 36 reservations
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findMatchingPeriod() {
  console.log('\n🔍 Finding Havet period with booking_step_1=363, reservations=36...\n');
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%havet%')
    .single();
    
  if (!client) {
    console.error('❌ Havet not found');
    return;
  }
  
  // Check all monthly summaries
  const { data: summaries } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .order('summary_date', { ascending: false });
    
  console.log('📊 All monthly summaries for Havet:\n');
  
  summaries?.forEach(s => {
    const match363 = s.booking_step_1 === 363;
    const match36 = s.reservations === 36;
    const highlight = match363 || match36 ? '⭐' : '  ';
    
    console.log(`${highlight} ${s.summary_date}:`);
    console.log(`     spend: ${s.total_spend?.toFixed(2)} zł`);
    console.log(`     booking_step_1: ${s.booking_step_1}${match363 ? ' ← MATCH!' : ''}`);
    console.log(`     booking_step_2: ${s.booking_step_2}`);
    console.log(`     booking_step_3: ${s.booking_step_3}`);
    console.log(`     reservations: ${s.reservations}${match36 ? ' ← MATCH!' : ''}`);
    console.log(`     reservation_value: ${s.reservation_value?.toFixed(2)} zł`);
    console.log();
  });
  
  // Also check weekly summaries
  console.log('\n📅 Checking weekly summaries...\n');
  
  const { data: weeklySummaries } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('platform', 'meta')
    .eq('summary_type', 'weekly')
    .order('summary_date', { ascending: false })
    .limit(20);
    
  weeklySummaries?.forEach(s => {
    const match363 = s.booking_step_1 === 363;
    const match36 = s.reservations === 36;
    const highlight = match363 || match36 ? '⭐' : '  ';
    
    console.log(`${highlight} ${s.summary_date} (week):`);
    console.log(`     booking_step_1: ${s.booking_step_1}${match363 ? ' ← MATCH!' : ''}`);
    console.log(`     booking_step_2: ${s.booking_step_2}`);
    console.log(`     booking_step_3: ${s.booking_step_3}`);
    console.log(`     reservations: ${s.reservations}${match36 ? ' ← MATCH!' : ''}`);
    console.log(`     reservation_value: ${s.reservation_value}`);
    console.log();
  });
}

findMatchingPeriod().catch(console.error);
