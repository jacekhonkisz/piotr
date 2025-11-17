/**
 * DIRECT META API TEST
 * 
 * This script directly calls the Meta API to see what data is being returned.
 * Run with: npx tsx scripts/test_meta_api_direct.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMetaAPI() {
  console.log('🔍 DIRECT META API TEST');
  console.log('======================\n');

  try {
    // Get Belmonte Hotel (the one with cached data)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('company', 'Belmonte Hotel')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('🏢 Testing with client:', client.company);
    console.log('   Ad Account:', client.ad_account_id);
    console.log('   Has Token:', !!client.meta_access_token);
    console.log();

    // Prepare request
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // Calculate current month date range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0]; // Today

    console.log('📅 Date Range:');
    console.log('   Start:', startDate);
    console.log('   End:', endDate);
    console.log();

    // Test 1: Get account-level insights (placement performance)
    console.log('🧪 TEST 1: Account-level insights (placement performance)');
    console.log('─'.repeat(60));
    
    const insightsUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?time_range={"since":"${startDate}","until":"${endDate}"}&fields=impressions,clicks,spend,cpm,cpc,ctr&breakdowns=publisher_platform,platform_position&limit=10&access_token=${client.meta_access_token}`;
    
    console.log('📡 Calling Meta API...');
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    if (insightsData.error) {
      console.error('❌ Meta API Error:', insightsData.error);
      console.error('   Message:', insightsData.error.message);
      console.error('   Code:', insightsData.error.code);
      console.error('   Type:', insightsData.error.type);
    } else {
      console.log('✅ API Response received');
      console.log('   Records returned:', insightsData.data?.length || 0);
      
      if (insightsData.data && insightsData.data.length > 0) {
        console.log('\n📊 First 3 records:');
        insightsData.data.slice(0, 3).forEach((record: any, index: number) => {
          console.log(`\n   Record ${index + 1}:`);
          console.log('      Platform:', record.publisher_platform);
          console.log('      Position:', record.platform_position);
          console.log('      Impressions:', record.impressions || 0);
          console.log('      Clicks:', record.clicks || 0);
          console.log('      Spend:', record.spend || 0);
          console.log('      CTR:', record.ctr || 0);
          console.log('      CPC:', record.cpc || 0);
        });

        // Calculate totals
        const totals = insightsData.data.reduce((acc: any, record: any) => ({
          impressions: acc.impressions + (parseInt(record.impressions) || 0),
          clicks: acc.clicks + (parseInt(record.clicks) || 0),
          spend: acc.spend + (parseFloat(record.spend) || 0)
        }), { impressions: 0, clicks: 0, spend: 0 });

        console.log('\n📊 TOTALS FROM API:');
        console.log('   Total Impressions:', totals.impressions);
        console.log('   Total Clicks:', totals.clicks);
        console.log('   Total Spend:', totals.spend);
      } else {
        console.log('⚠️  No data returned from Meta API');
        console.log('⚠️  This means the ad account has NO activity in this date range');
      }
    }

    console.log('\n');

    // Test 2: Get campaigns list
    console.log('🧪 TEST 2: Campaigns list');
    console.log('─'.repeat(60));
    
    const campaignsUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns?fields=id,name,status,effective_status,objective,created_time,updated_time&limit=10&access_token=${client.meta_access_token}`;
    
    console.log('📡 Calling Meta API...');
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      console.error('❌ Meta API Error:', campaignsData.error);
    } else {
      console.log('✅ API Response received');
      console.log('   Campaigns returned:', campaignsData.data?.length || 0);
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        console.log('\n📋 First 5 campaigns:');
        campaignsData.data.slice(0, 5).forEach((campaign: any, index: number) => {
          console.log(`\n   ${index + 1}. ${campaign.name}`);
          console.log('      ID:', campaign.id);
          console.log('      Status:', campaign.status);
          console.log('      Effective Status:', campaign.effective_status);
          console.log('      Objective:', campaign.objective);
        });
      }
    }

    console.log('\n');

    // Test 3: Get campaign-level insights for first campaign
    if (campaignsData.data && campaignsData.data.length > 0) {
      const firstCampaign = campaignsData.data[0];
      
      console.log('🧪 TEST 3: Campaign-level insights for first campaign');
      console.log('─'.repeat(60));
      console.log('Campaign:', firstCampaign.name);
      
      const campaignInsightsUrl = `https://graph.facebook.com/v21.0/${firstCampaign.id}/insights?time_range={"since":"${startDate}","until":"${endDate}"}&fields=impressions,clicks,spend,reach,frequency&access_token=${client.meta_access_token}`;
      
      console.log('📡 Calling Meta API...');
      const campaignInsightsResponse = await fetch(campaignInsightsUrl);
      const campaignInsightsData = await campaignInsightsResponse.json();

      if (campaignInsightsData.error) {
        console.error('❌ Meta API Error:', campaignInsightsData.error);
      } else {
        console.log('✅ API Response received');
        console.log('   Records returned:', campaignInsightsData.data?.length || 0);
        
        if (campaignInsightsData.data && campaignInsightsData.data.length > 0) {
          const insights = campaignInsightsData.data[0];
          console.log('\n📊 Campaign Insights:');
          console.log('      Impressions:', insights.impressions || 0);
          console.log('      Clicks:', insights.clicks || 0);
          console.log('      Spend:', insights.spend || 0);
          console.log('      Reach:', insights.reach || 0);
          console.log('      Frequency:', insights.frequency || 0);
        } else {
          console.log('⚠️  No insights data for this campaign in the date range');
        }
      }
    }

    console.log('\n');
    console.log('=' .repeat(60));
    console.log('\n🎯 DIAGNOSIS:');
    console.log('─'.repeat(60));

    if (insightsData.data && insightsData.data.length > 0) {
      const totals = insightsData.data.reduce((acc: any, record: any) => ({
        spend: acc.spend + (parseFloat(record.spend) || 0)
      }), { spend: 0 });

      if (totals.spend > 0) {
        console.log('✅ Meta API is working correctly');
        console.log('✅ Account has activity in November 2025');
        console.log('✅ Data is being returned with metrics');
        console.log('\n🔧 The issue is likely in data processing/caching');
      } else {
        console.log('⚠️  Meta API returns data BUT all metrics are 0');
        console.log('⚠️  This means:');
        console.log('   - Campaigns exist');
        console.log('   - But they have NO spend/impressions in this period');
        console.log('   - Campaigns might be paused or inactive');
      }
    } else {
      console.log('❌ Meta API returns NO data for this date range');
      console.log('❌ This means:');
      console.log('   - No campaign activity in November 2025');
      console.log('   - All campaigns are paused/stopped');
      console.log('   - Or date range is incorrect');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testMetaAPI().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});





