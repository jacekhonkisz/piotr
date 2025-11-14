/**
 * DIRECT MANUAL DATA COLLECTION
 * Bypasses background-data-collector to collect missing data directly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function directCollectMissingData() {
  console.log('🚀 DIRECT MANUAL COLLECTION - BYPASSING AUTOMATED SYSTEM\n');
  console.log('═'.repeat(70) + '\n');

  try {
    // Get Belmonte client (the one we know needs data)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();

    if (clientError) {
      console.error('Error fetching client:', clientError);
      return;
    }

    console.log(`📊 Collecting data for: ${client.name}\n`);
    console.log(`Current records for Belmonte:`);
    
    // Check what Belmonte currently has
    const { data: existing } = await supabase
      .from('campaign_summaries')
      .select('platform, summary_type')
      .eq('client_id', client.id);

    const metaWeekly = existing.filter(r => r.platform === 'meta' && r.summary_type === 'weekly').length;
    const googleWeekly = existing.filter(r => r.platform === 'google' && r.summary_type === 'weekly').length;
    
    console.log(`  Meta Weekly: ${metaWeekly} / 53`);
    console.log(`  Google Weekly: ${googleWeekly} / 53\n`);

    // Call the API endpoint directly with explicit parameters
    const response = await fetch('http://localhost:3000/api/admin/collect-weekly-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Collection triggered successfully\n');
      console.log('⏰ Waiting 5 minutes for collection to complete...\n');
      
      // Wait and check progress
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        const { data: updated } = await supabase
          .from('campaign_summaries')
          .select('platform, summary_type')
          .eq('client_id', client.id);

        const newMetaWeekly = updated.filter(r => r.platform === 'meta' && r.summary_type === 'weekly').length;
        const newGoogleWeekly = updated.filter(r => r.platform === 'google' && r.summary_type === 'weekly').length;
        
        const metaChange = newMetaWeekly - metaWeekly;
        const googleChange = newGoogleWeekly - googleWeekly;
        
        console.log(`[${Math.floor((i + 1) * 10 / 6)} min] Meta: ${newMetaWeekly} (+${metaChange}), Google: ${newGoogleWeekly} (+${googleChange})`);
        
        if (newMetaWeekly >= 53 && newGoogleWeekly >= 53) {
          console.log('\n🎉 Collection complete for Belmonte!\n');
          break;
        }
      }
    } else {
      console.error('❌ Collection failed:', result.error);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

directCollectMissingData();



