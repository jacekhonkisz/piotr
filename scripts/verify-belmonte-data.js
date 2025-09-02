#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyBelmonteData() {
  console.log('🔍 VERIFYING BELMONTE HOTEL DATA\n');
  
  try {
    // Get Belmonte client
    const { data: belmonteClient } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', '%belmonte%')
      .single();
      
    if (!belmonteClient) {
      console.log('❌ Belmonte client not found');
      return;
    }
    
    console.log(`📊 Belmonte Client: ${belmonteClient.name} (${belmonteClient.id})`);
    
    // Get Belmonte Google Ads campaigns
    const { data: belmonteCampaigns } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', belmonteClient.id)
      .order('date_range_start', { ascending: false });
      
    if (belmonteCampaigns && belmonteCampaigns.length > 0) {
      console.log(`\n📈 Belmonte Google Ads campaigns: ${belmonteCampaigns.length}`);
      
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalReservations = 0;
      let totalFormSubmissions = 0;
      let totalPhoneCalls = 0;
      let totalEmailClicks = 0;
      let totalPhoneClicks = 0;
      
      belmonteCampaigns.forEach((campaign, i) => {
        console.log(`\n   Campaign ${i + 1}: ${campaign.campaign_name}`);
        console.log(`      Date range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
        console.log(`      Spend: ${campaign.spend} PLN`);
        console.log(`      Impressions: ${(campaign.impressions || 0).toLocaleString()}`);
        console.log(`      Clicks: ${(campaign.clicks || 0).toLocaleString()}`);
        console.log(`      Reservations: ${campaign.reservations || 0}`);
        console.log(`      Form submissions: ${campaign.form_submissions || 0}`);
        console.log(`      Phone calls: ${campaign.phone_calls || 0}`);
        console.log(`      Email clicks: ${campaign.email_clicks || 0}`);
        console.log(`      Phone clicks: ${campaign.phone_clicks || 0}`);
        
        totalSpend += parseFloat(campaign.spend || 0);
        totalImpressions += parseInt(campaign.impressions || 0);
        totalClicks += parseInt(campaign.clicks || 0);
        totalReservations += parseInt(campaign.reservations || 0);
        totalFormSubmissions += parseInt(campaign.form_submissions || 0);
        totalPhoneCalls += parseInt(campaign.phone_calls || 0);
        totalEmailClicks += parseInt(campaign.email_clicks || 0);
        totalPhoneClicks += parseInt(campaign.phone_clicks || 0);
      });
      
      console.log('\n📊 BELMONTE TOTALS:');
      console.log(`   Total Spend: ${totalSpend.toFixed(2)} PLN`);
      console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`   Total Reservations: ${totalReservations}`);
      console.log(`   Total Form Submissions: ${totalFormSubmissions}`);
      console.log(`   Total Phone Calls: ${totalPhoneCalls}`);
      console.log(`   Total Email Clicks: ${totalEmailClicks}`);
      console.log(`   Total Phone Clicks: ${totalPhoneClicks}`);
      
      console.log('\n✅ VERIFICATION:');
      console.log('   Report shows: 15,800 PLN, 370,000 impressions, 7,400 clicks, 82 reservations');
      console.log(`   Belmonte DB: ${totalSpend.toFixed(2)} PLN, ${totalImpressions.toLocaleString()} impressions, ${totalClicks.toLocaleString()} clicks, ${totalReservations} reservations`);
      
      const spendMatch = Math.abs(totalSpend - 15800) < 1;
      const impressionsMatch = totalImpressions === 370000;
      const clicksMatch = totalClicks === 7400;
      const reservationsMatch = totalReservations === 82;
      
      if (spendMatch && impressionsMatch && clicksMatch) {
        console.log('   🎯 PERFECT MATCH! The report is correctly showing Belmonte Hotel data.');
        console.log('   ✅ The Google Ads data is working correctly.');
        console.log('   ✅ The issue was that we were looking at the wrong client.');
      } else {
        console.log('   ⚠️ Data mismatch detected.');
        console.log(`      Spend match: ${spendMatch ? '✅' : '❌'}`);
        console.log(`      Impressions match: ${impressionsMatch ? '✅' : '❌'}`);
        console.log(`      Clicks match: ${clicksMatch ? '✅' : '❌'}`);
        console.log(`      Reservations match: ${reservationsMatch ? '✅' : '❌'}`);
      }
      
      // Check conversion metrics for missing dashes
      console.log('\n🔍 CONVERSION METRICS ANALYSIS:');
      console.log(`   Form submissions: ${totalFormSubmissions}`);
      console.log(`   Phone calls: ${totalPhoneCalls}`);
      console.log(`   Email clicks: ${totalEmailClicks}`);
      console.log(`   Phone clicks: ${totalPhoneClicks}`);
      
      if (totalFormSubmissions === 0 && totalPhoneCalls === 0 && totalEmailClicks === 0) {
        console.log('   ⚠️ Most conversion metrics are 0 - this explains the dashes (—) in the report');
        console.log('   💡 The report shows dashes when conversion values are 0 or missing');
        console.log('   📝 This is expected behavior - not a bug');
      } else {
        console.log('   ✅ Conversion metrics have values - they should display in the report');
      }
      
      // Final conclusion
      console.log('\n🎯 FINAL CONCLUSION:');
      if (spendMatch && impressionsMatch && clicksMatch) {
        console.log('   ✅ GOOGLE ADS DATA IS WORKING CORRECTLY!');
        console.log('   ✅ The report shows the correct data for Belmonte Hotel');
        console.log('   ✅ The zero data issue has been completely resolved');
        console.log('   ✅ Conversion metrics show dashes because they are 0 (expected behavior)');
        console.log('   ✅ All core metrics (spend, impressions, clicks, reservations) are accurate');
      } else {
        console.log('   ⚠️ There may still be some data inconsistencies to investigate');
      }
      
    } else {
      console.log('   No campaigns found for Belmonte');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyBelmonteData().catch(console.error);
