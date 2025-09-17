const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignsStructure() {
  console.log('🔍 Checking Campaigns Table Structure...\n');

  try {
    // Get a sample of campaigns to see the structure
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(3);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log('📋 Campaigns table structure:');
    if (campaigns.length > 0) {
      console.log('Columns found:', Object.keys(campaigns[0]));
      console.log('\nSample campaign data:');
      console.log(JSON.stringify(campaigns[0], null, 2));
    } else {
      console.log('⚠️  No campaigns found in the table');
    }

    // Check if there are any campaigns at all
    const { count, error: countError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting campaigns:', countError);
    } else {
      console.log(`\n📊 Total campaigns in database: ${count}`);
    }

    // Check for any date-related columns
    if (campaigns.length > 0) {
      const sampleCampaign = campaigns[0];
      const dateColumns = Object.keys(sampleCampaign).filter(key => 
        key.toLowerCase().includes('date') || 
        key.toLowerCase().includes('time') || 
        key.toLowerCase().includes('created') ||
        key.toLowerCase().includes('updated')
      );
      
      console.log('\n📅 Date-related columns found:', dateColumns);
      
      if (dateColumns.length > 0) {
        console.log('\nSample date values:');
        dateColumns.forEach(col => {
          console.log(`   ${col}: ${sampleCampaign[col]}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error checking campaigns structure:', error);
  }
}

checkCampaignsStructure(); 