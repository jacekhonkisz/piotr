require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function detailedMetaAudit() {
  console.log('🔍 Detailed Meta Ads API Data Availability Audit\n');
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

    console.log('\n🔍 Starting Detailed API Audit...\n');

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

    // Get all available insights data
    console.log('2️⃣ Fetching all available insights data...');
    try {
      const insightsUrl = `${baseUrl}/act_${adAccountId}/insights?access_token=${accessToken}&fields=spend,impressions,clicks,inline_link_clicks,actions,action_values,purchase_roas&time_range={'since':'2024-01-01','until':'2024-12-31'}&limit=1`;
      
      const response = await fetch(insightsUrl);
      const data = await response.json();

      if (data.error) {
        console.error('❌ Insights API error:', data.error.message);
        return;
      }

      if (!data.data || data.data.length === 0) {
        console.error('❌ No insights data available');
        return;
      }

      const insight = data.data[0];
      console.log('✅ Insights data retrieved successfully\n');

      // Analyze available data
      console.log('3️⃣ Analyzing available metrics...\n');

      const results = [];

      // Basic metrics
      const basicMetrics = [
        { name: 'Spend', field: 'spend', value: insight.spend },
        { name: 'Impressions', field: 'impressions', value: insight.impressions },
        { name: 'Clicks', field: 'clicks', value: insight.clicks },
        { name: 'Link Clicks', field: 'inline_link_clicks', value: insight.inline_link_clicks },
        { name: 'ROAS', field: 'purchase_roas', value: insight.purchase_roas }
      ];

      basicMetrics.forEach(metric => {
        const isAvailable = metric.value !== undefined && metric.value !== null;
        results.push({
          metric: metric.name,
          status: isAvailable ? 'AVAILABLE' : 'NOT AVAILABLE',
          sampleValue: isAvailable ? metric.value : '-',
          reason: isAvailable ? '-' : `No ${metric.name.toLowerCase()} data found`
        });
        console.log(`   ${isAvailable ? '✅' : '❌'} ${metric.name}: ${isAvailable ? metric.value : 'Not available'}`);
      });

      // Analyze actions
      console.log('\n4️⃣ Analyzing available actions...\n');
      
      if (insight.actions && Array.isArray(insight.actions)) {
        console.log('📊 Available actions:');
        insight.actions.forEach(action => {
          console.log(`   • ${action.action_type}: ${action.value}`);
        });

        // Check for specific action types
        const actionTypes = ['lead', 'link_click', 'click_to_call', 'purchase'];
        const foundActions = [];

        actionTypes.forEach(actionType => {
          const matchingAction = insight.actions.find(action => 
            action.action_type === actionType || 
            action.action_type?.includes(actionType)
          );
          
          if (matchingAction) {
            foundActions.push({
              name: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Actions`,
              value: matchingAction.value,
              actionType: actionType
            });
            console.log(`   ✅ ${actionType}: ${matchingAction.value}`);
          } else {
            console.log(`   ❌ ${actionType}: Not available`);
          }
        });

        // Add action results to main results
        foundActions.forEach(action => {
          results.push({
            metric: action.name,
            status: 'AVAILABLE',
            sampleValue: action.value,
            reason: '-'
          });
        });

        // Add missing actions
        const missingActions = actionTypes.filter(actionType => 
          !insight.actions.find(action => 
            action.action_type === actionType || 
            action.action_type?.includes(actionType)
          )
        );

        missingActions.forEach(actionType => {
          const actionName = actionType === 'lead' ? 'Lead Form Submissions' :
                           actionType === 'link_click' ? 'Email Clicks' :
                           actionType === 'click_to_call' ? 'Phone Number Clicks' :
                           actionType === 'purchase' ? 'Reservations' : actionType;
          
          results.push({
            metric: actionName,
            status: 'NOT AVAILABLE',
            sampleValue: '-',
            reason: `No ${actionType} actions found in account`
          });
        });

      } else {
        console.log('❌ No actions data available');
        
        // Add all action types as not available
        const actionTypes = [
          { name: 'Lead Form Submissions', type: 'lead' },
          { name: 'Email Clicks', type: 'link_click' },
          { name: 'Phone Number Clicks', type: 'click_to_call' },
          { name: 'Reservations', type: 'purchase' }
        ];

        actionTypes.forEach(action => {
          results.push({
            metric: action.name,
            status: 'NOT AVAILABLE',
            sampleValue: '-',
            reason: `No ${action.type} actions found in account`
          });
        });
      }

      // Analyze action values
      console.log('\n5️⃣ Analyzing action values...\n');
      
      if (insight.action_values && Array.isArray(insight.action_values)) {
        console.log('📊 Available action values:');
        insight.action_values.forEach(actionValue => {
          console.log(`   • ${actionValue.action_type}: ${actionValue.value}`);
        });

        // Check for purchase values
        const purchaseValue = insight.action_values.find(av => 
          av.action_type === 'purchase'
        );

        if (purchaseValue) {
          results.push({
            metric: 'Reservation Value',
            status: 'AVAILABLE',
            sampleValue: purchaseValue.value,
            reason: '-'
          });
          console.log(`   ✅ Reservation Value: ${purchaseValue.value}`);
        } else {
          results.push({
            metric: 'Reservation Value',
            status: 'NOT AVAILABLE',
            sampleValue: '-',
            reason: 'No purchase action values found in account'
          });
          console.log(`   ❌ Reservation Value: Not available`);
        }
      } else {
        results.push({
          metric: 'Reservation Value',
          status: 'NOT AVAILABLE',
          sampleValue: '-',
          reason: 'No action values data available'
        });
        console.log(`   ❌ Reservation Value: No data available`);
      }

      // Generate final report
      console.log('\n' + '='.repeat(80));
      console.log('📊 DETAILED META ADS API DATA AVAILABILITY AUDIT REPORT');
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
      console.error('❌ Detailed audit failed:', error);
    }

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

detailedMetaAudit(); 