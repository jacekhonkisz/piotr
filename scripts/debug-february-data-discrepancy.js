// Debug script to understand why February data disappeared and April shows different values
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugFebruaryDataDiscrepancy() {
  console.log('🔍 Debug: February Data Discrepancy Analysis\n');

  try {
    // 1. Get client data
    console.log('📋 Step 1: Getting client data...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, created_at, ad_account_id, meta_access_token')
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No clients found:', clientError);
      return;
    }

    const client = clients[0];
    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      created_at: client.created_at,
      ad_account_id: client.ad_account_id,
      hasToken: !!client.meta_access_token
    });

    if (!client.meta_access_token) {
      console.error('❌ No Meta API token found');
      return;
    }

    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // 2. Check campaign status and creation dates
    console.log('\n📋 Step 2: Checking campaign status and creation dates...');
    
    const campaignsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?access_token=${client.meta_access_token}&fields=id,name,status,created_time,start_time,stop_time,objective`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        console.log('📊 All campaigns in account:');
        campaignsData.data.forEach(campaign => {
          const createdDate = new Date(campaign.created_time);
          const startDate = campaign.start_time ? new Date(campaign.start_time) : null;
          const stopDate = campaign.stop_time ? new Date(campaign.stop_time) : null;
          
          console.log(`- ${campaign.name} (${campaign.id})`);
          console.log(`  Status: ${campaign.status}`);
          console.log(`  Created: ${createdDate.toISOString().split('T')[0]}`);
          console.log(`  Start: ${startDate ? startDate.toISOString().split('T')[0] : 'Not set'}`);
          console.log(`  Stop: ${stopDate ? stopDate.toISOString().split('T')[0] : 'Not set'}`);
          console.log(`  Objective: ${campaign.objective}`);
          console.log('');
        });
      } else {
        console.log('⚠️ No campaigns found in account');
      }
    } catch (error) {
      console.log('❌ Error fetching campaigns:', error.message);
    }

    // 3. Test different date ranges for February
    console.log('\n📅 Step 3: Testing different February date ranges...');
    
    const februaryRanges = [
      { start: '2024-02-01', end: '2024-02-29', name: 'Full February 2024' },
      { start: '2024-02-01', end: '2024-02-28', name: 'February 2024 (non-leap year)' },
      { start: '2024-02-15', end: '2024-02-29', name: 'February 2024 (second half)' },
      { start: '2024-02-20', end: '2024-02-29', name: 'February 2024 (last 10 days)' },
      { start: '2024-02-25', end: '2024-02-29', name: 'February 2024 (last 5 days)' }
    ];

    for (const range of februaryRanges) {
      console.log(`\n🔍 Testing ${range.name} (${range.start} to ${range.end})...`);
      
      const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${range.start}","until":"${range.end}"}&level=campaign`;
      
      try {
        const response = await fetch(insightsUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          const totalSpend = data.data.reduce((sum, insight) => sum + (parseFloat(insight.spend) || 0), 0);
          console.log(`✅ Found data: ${totalSpend.toFixed(2)} PLN`);
          console.log(`   Campaigns:`, data.data.map(c => ({
            name: c.campaign_name,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks
          })));
        } else {
          console.log(`⚠️ No data found`);
        }
      } catch (error) {
        console.log(`❌ Error:`, error.message);
      }
    }

    // 4. Test April with different parameters
    console.log('\n📅 Step 4: Testing April with different parameters...');
    
    const aprilRanges = [
      { start: '2024-04-01', end: '2024-04-30', name: 'Full April 2024' },
      { start: '2024-04-01', end: '2024-04-29', name: 'April 2024 (until April 29)' },
      { start: '2024-04-01', end: '2024-04-15', name: 'April 2024 (first half)' },
      { start: '2024-04-15', end: '2024-04-30', name: 'April 2024 (second half)' }
    ];

    for (const range of aprilRanges) {
      console.log(`\n🔍 Testing ${range.name} (${range.start} to ${range.end})...`);
      
      const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${range.start}","until":"${range.end}"}&level=campaign`;
      
      try {
        const response = await fetch(insightsUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          const totalSpend = data.data.reduce((sum, insight) => sum + (parseFloat(insight.spend) || 0), 0);
          console.log(`✅ Found data: ${totalSpend.toFixed(2)} PLN`);
          console.log(`   Campaigns:`, data.data.map(c => ({
            name: c.campaign_name,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks
          })));
        } else {
          console.log(`⚠️ No data found`);
        }
      } catch (error) {
        console.log(`❌ Error:`, error.message);
      }
    }

    // 5. Check if there's a timezone issue
    console.log('\n🌍 Step 5: Checking for timezone issues...');
    
    // Test with different timezone considerations
    const timezoneTests = [
      { start: '2024-02-01T00:00:00+01:00', end: '2024-02-29T23:59:59+01:00', name: 'February with timezone' },
      { start: '2024-04-01T00:00:00+02:00', end: '2024-04-30T23:59:59+02:00', name: 'April with timezone' }
    ];

    for (const test of timezoneTests) {
      console.log(`\n🔍 Testing ${test.name}...`);
      
      const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${test.start}","until":"${test.end}"}&level=campaign`;
      
      try {
        const response = await fetch(insightsUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          const totalSpend = data.data.reduce((sum, insight) => sum + (parseFloat(insight.spend) || 0), 0);
          console.log(`✅ Found data: ${totalSpend.toFixed(2)} PLN`);
        } else {
          console.log(`⚠️ No data found`);
        }
      } catch (error) {
        console.log(`❌ Error:`, error.message);
      }
    }

    // 6. Summary
    console.log('\n📊 Step 6: Summary and Analysis...');
    console.log('🔍 Key findings:');
    console.log('- February 2024 data appears to have disappeared from Meta API');
    console.log('- April 2024 shows 234.48 PLN instead of expected 247 PLN');
    console.log('- This suggests data may have been deleted, archived, or moved');
    console.log('- Campaign status changes may affect data availability');
    
    console.log('\n💡 Possible explanations:');
    console.log('1. Campaigns were deleted or archived');
    console.log('2. Data was moved to a different ad account');
    console.log('3. Meta API data retention policies');
    console.log('4. Campaign status changes (PAUSED, DELETED, etc.)');
    console.log('5. Timezone or date boundary issues');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugFebruaryDataDiscrepancy(); 