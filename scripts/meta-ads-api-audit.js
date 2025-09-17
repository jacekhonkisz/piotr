require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditMetaAdsAPI() {
  console.log('🔍 Meta Ads API Data Availability Audit\n');
  console.log('📋 Target Account: jac.honkisz@gmail.com\n');

  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', {
      name: client.name,
      email: client.email,
      ad_account_id: client.ad_account_id,
      has_token: !!client.meta_access_token
    });

    if (!client.meta_access_token) {
      console.error('❌ No Meta access token found');
      return;
    }

    const baseUrl = 'https://graph.facebook.com/v18.0';
    const adAccountId = client.ad_account_id;
    const accessToken = client.meta_access_token;

    console.log('\n🔍 Starting API Audit...\n');

    // Define metrics to audit with correct field names
    const metrics = [
      {
        name: 'Spend',
        field: 'spend',
        description: 'Total ad spend'
      },
      {
        name: 'Impressions',
        field: 'impressions',
        description: 'Total impressions'
      },
      {
        name: 'Clicks',
        field: 'clicks',
        description: 'Total clicks'
      },
      {
        name: 'Link Clicks',
        field: 'inline_link_clicks',
        description: 'Link clicks'
      },
      {
        name: 'Lead Form Submissions',
        field: 'actions',
        actionType: 'lead',
        description: 'Lead form submissions'
      },
      {
        name: 'Email Clicks',
        field: 'actions',
        actionType: 'link_click',
        description: 'Email link clicks (mailto:)'
      },
      {
        name: 'Phone Number Clicks',
        field: 'actions',
        actionType: 'click_to_call',
        description: 'Phone number clicks'
      },
      {
        name: 'Reservations',
        field: 'actions',
        actionType: 'purchase',
        description: 'Reservation events (purchase)'
      },
      {
        name: 'Reservation Value',
        field: 'action_values',
        actionType: 'purchase',
        description: 'Value from reservation events'
      },
      {
        name: 'ROAS',
        field: 'purchase_roas',
        description: 'Return on ad spend'
      }
    ];

    const results = [];

    // Test basic account access first
    console.log('1️⃣ Testing basic account access...');
    try {
      const accountUrl = `${baseUrl}/act_${adAccountId}?access_token=${accessToken}&fields=id,name,account_id,currency,timezone_name`;
      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json();

      if (accountData.error) {
        console.error('❌ Account access error:', accountData.error.message);
        return;
      }

      console.log('✅ Account access successful');
      console.log(`   Account: ${accountData.name}`);
      console.log(`   Currency: ${accountData.currency}`);
      console.log(`   Timezone: ${accountData.timezone_name}\n`);
    } catch (error) {
      console.error('❌ Account access failed:', error.message);
      return;
    }

    // Test each metric
    for (const metric of metrics) {
      console.log(`🔍 Testing: ${metric.name}`);
      
      try {
        let fields = metric.field;
        let breakdowns = null;

        if (metric.field === 'actions' || metric.field === 'action_values') {
          // For actions, we need to request all actions and then filter
          fields = `${metric.field}`;
        }

        const insightsUrl = `${baseUrl}/act_${adAccountId}/insights?access_token=${accessToken}&fields=${fields}&time_range={'since':'2024-01-01','until':'2024-12-31'}&limit=1`;
        
        const response = await fetch(insightsUrl);
        const data = await response.json();

        if (data.error) {
          results.push({
            metric: metric.name,
            status: 'NOT AVAILABLE',
            sampleValue: '-',
            reason: `API Error: ${data.error.message}`
          });
          console.log(`   ❌ ${metric.name}: API Error - ${data.error.message}`);
        } else if (!data.data || data.data.length === 0) {
          results.push({
            metric: metric.name,
            status: 'NOT AVAILABLE',
            sampleValue: '-',
            reason: 'No data returned for this metric'
          });
          console.log(`   ❌ ${metric.name}: No data returned`);
        } else {
          const insight = data.data[0];
          let sampleValue = '-';
          let isAvailable = false;

          if (metric.field === 'actions' || metric.field === 'action_values') {
            // Check for specific action types
            if (insight[metric.field]) {
              const actions = Array.isArray(insight[metric.field]) ? insight[metric.field] : [insight[metric.field]];
              const matchingAction = actions.find(action => 
                action.action_type === metric.actionType || 
                action.action_type?.includes(metric.actionType)
              );
              
              if (matchingAction) {
                sampleValue = metric.field === 'action_values' ? 
                  `${matchingAction.value || 'N/A'}` : 
                  `${matchingAction.value || 'N/A'}`;
                isAvailable = true;
              }
            }
          } else {
            // Direct field access
            if (insight[metric.field] !== undefined && insight[metric.field] !== null) {
              sampleValue = insight[metric.field];
              isAvailable = true;
            }
          }

          if (isAvailable) {
            results.push({
              metric: metric.name,
              status: 'AVAILABLE',
              sampleValue: sampleValue,
              reason: '-'
            });
            console.log(`   ✅ ${metric.name}: ${sampleValue}`);
          } else {
            results.push({
              metric: metric.name,
              status: 'NOT AVAILABLE',
              sampleValue: '-',
              reason: `No ${metric.description.toLowerCase()} found in account`
            });
            console.log(`   ❌ ${metric.name}: No data found`);
          }
        }
      } catch (error) {
        results.push({
          metric: metric.name,
          status: 'NOT AVAILABLE',
          sampleValue: '-',
          reason: `Network error: ${error.message}`
        });
        console.log(`   ❌ ${metric.name}: Network error - ${error.message}`);
      }
    }

    // Generate final report
    console.log('\n' + '='.repeat(80));
    console.log('📊 META ADS API DATA AVAILABILITY AUDIT REPORT');
    console.log('='.repeat(80));
    console.log(`Account: ${client.name} (${client.email})`);
    console.log(`Ad Account ID: ${adAccountId}`);
    console.log(`Audit Date: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

    console.log('\n| Metric                      | Status         | Sample Value   | If NOT available – Reason or Setup Instruction       |');
    console.log('|-----------------------------|---------------|---------------|-----------------------------------------------------|');

    results.forEach(result => {
      const metric = result.metric.padEnd(28);
      const status = result.status.padEnd(15);
      const sampleValue = (result.sampleValue || '-').padEnd(15);
      const reason = result.reason || '-';
      
      console.log(`| ${metric} | ${status} | ${sampleValue} | ${reason} |`);
    });

    // Summary
    const availableCount = results.filter(r => r.status === 'AVAILABLE').length;
    const totalCount = results.length;

    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Available metrics: ${availableCount}/${totalCount}`);
    console.log(`❌ Missing metrics: ${totalCount - availableCount}/${totalCount}`);

    if (availableCount < totalCount) {
      console.log('\n🔧 SETUP RECOMMENDATIONS:');
      console.log('='.repeat(80));
      
      const missingMetrics = results.filter(r => r.status === 'NOT AVAILABLE');
      missingMetrics.forEach(metric => {
        console.log(`• ${metric.metric}: ${metric.reason}`);
      });

      console.log('\n💡 TO ENABLE MISSING METRICS:');
      console.log('• Lead Form Submissions: Create Lead Ads campaigns');
      console.log('• Email/Phone Clicks: Add click-to-call or mailto: links in ad creatives');
      console.log('• Reservations/Value: Set up Facebook Pixel with purchase events on website');
      console.log('• ROAS: Configure value parameter in Pixel events');
    }

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditMetaAdsAPI(); 