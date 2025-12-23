#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCampaignFields() {
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', '%havet%')
    .single();
    
  if (!client) return;
  
  const { data: summary } = await supabase
    .from('campaign_summaries')
    .select('campaign_data')
    .eq('client_id', client.id)
    .eq('summary_date', '2024-12-01')
    .single();
    
  if (summary?.campaign_data) {
    const campaigns = summary.campaign_data as any[];
    console.log('Campaign fields in Dec 2024:', Object.keys(campaigns[0]));
    console.log('\nFirst campaign values:');
    console.log('  reservation_value:', campaigns[0].reservation_value);
    console.log('  conversion_value:', campaigns[0].conversion_value);
    console.log('  total_conversion_value:', campaigns[0].total_conversion_value);
  }
}

checkCampaignFields();
