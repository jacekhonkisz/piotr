require('dotenv').config({ path: '.env.local' });

async function testHavetToken() {
  console.log('🧪 Testing new Havet Meta API token...\n');

  const token = 'EAAKZBRTlpNXsBPIbjitymINStheW5ZBI6pgqajiCarZBAWzZCDjWPQ0ZBbCSTVenrjbLtZABiIhb1FfqTZBAvLYq2xVeynw18d3d54qlkN0OmcUZCZAZCBQoO56h0TnUU9hxb37T53SDSgdbJUjTf3qveGQ2V4ptP2Cul7avKcZA14Vr1cNZCSE7yDWwQGPV9QyWn9MVIKMNBUL3';
  const adAccountId = '659510566204299';

  console.log('🔑 Token Preview:', token.substring(0, 20) + '...');
  console.log('🏢 Ad Account ID:', adAccountId);
  console.log('');

  try {
    // Test 1: Basic token validity
    console.log('1️⃣ Testing basic token validity...');
    const tokenTestResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${token}`);
    const tokenTestData = await tokenTestResponse.json();
    
    if (tokenTestData.error) {
      console.log(`   ❌ Token Error: ${tokenTestData.error.message}`);
      return;
    } else {
      console.log(`   ✅ Token Valid: ${tokenTestData.name} (ID: ${tokenTestData.id})`);
    }

    // Test 2: Ad account access
    console.log('\n2️⃣ Testing ad account access...');
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const accountTestResponse = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}?fields=id,name,account_id&access_token=${token}`
    );
    const accountTestData = await accountTestResponse.json();
    
    if (accountTestData.error) {
      console.log(`   ❌ Ad Account Error: ${accountTestData.error.message}`);
      console.log(`   🔧 Required: ads_read or ads_management permission`);
    } else {
      console.log(`   ✅ Ad Account Access: ${accountTestData.name} (ID: ${accountTestData.account_id})`);
    }

    // Test 3: Campaign insights access (this is what's needed for conversion tracking)
    console.log('\n3️⃣ Testing campaign insights access...');
    const insightsTestResponse = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&limit=5&access_token=${token}`
    );
    const insightsTestData = await insightsTestResponse.json();
    
    if (insightsTestData.error) {
      console.log(`   ❌ Campaign Insights Error: ${insightsTestData.error.message}`);
      console.log(`   🔧 This is why conversion tracking shows "Nie skonfigurowane"`);
    } else {
      console.log(`   ✅ Campaign Insights Access: Available`);
      console.log(`   📊 Found ${insightsTestData.data?.length || 0} campaigns with insights`);
      
      if (insightsTestData.data && insightsTestData.data.length > 0) {
        console.log('\n   📋 Sample campaign data:');
        insightsTestData.data.slice(0, 2).forEach((campaign, index) => {
          console.log(`      ${index + 1}. ${campaign.campaign_name}`);
          console.log(`         - Impressions: ${campaign.impressions || 0}`);
          console.log(`         - Clicks: ${campaign.clicks || 0}`);
          console.log(`         - Spend: ${campaign.spend || 0}`);
          
          // Check for conversion tracking data
          if (campaign.actions && campaign.actions.length > 0) {
            console.log(`         - Actions: ${campaign.actions.length} action types`);
            campaign.actions.forEach(action => {
              console.log(`           * ${action.action_type}: ${action.value}`);
            });
          } else {
            console.log(`         - Actions: No conversion tracking data`);
          }
        });
      }
    }

    // Test 4: Specific conversion tracking fields
    console.log('\n4️⃣ Testing conversion tracking fields...');
    const conversionTestResponse = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,actions,action_values&limit=1&access_token=${token}`
    );
    const conversionTestData = await conversionTestResponse.json();
    
    if (conversionTestData.error) {
      console.log(`   ❌ Conversion Data Error: ${conversionTestData.error.message}`);
    } else if (conversionTestData.data && conversionTestData.data.length > 0) {
      const campaign = conversionTestData.data[0];
      console.log(`   ✅ Conversion data available for: ${campaign.campaign_name}`);
      
      // Check for specific conversion events
      const conversionEvents = ['click_to_call', 'lead', 'purchase', 'booking_step_1', 'booking_step_2', 'booking_step_3'];
      const foundEvents = [];
      
      if (campaign.actions) {
        campaign.actions.forEach(action => {
          if (conversionEvents.includes(action.action_type)) {
            foundEvents.push(`${action.action_type}: ${action.value}`);
          }
        });
      }
      
      if (foundEvents.length > 0) {
        console.log(`   🎯 Found conversion events: ${foundEvents.join(', ')}`);
      } else {
        console.log(`   ⚠️ No conversion events found (Pixel may not be configured)`);
      }
    } else {
      console.log(`   ⚠️ No campaign data available for conversion testing`);
    }

    // Test 5: Token permissions
    console.log('\n5️⃣ Testing token permissions...');
    const permissionsResponse = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`);
    const permissionsData = await permissionsResponse.json();
    
    if (permissionsData.error) {
      console.log(`   ❌ Permissions Error: ${permissionsData.error.message}`);
    } else {
      console.log(`   ✅ Permissions available:`);
      const requiredPermissions = ['ads_read', 'ads_management', 'business_management'];
      
      requiredPermissions.forEach(permission => {
        const hasPermission = permissionsData.data?.some(p => p.permission === permission && p.status === 'granted');
        console.log(`      ${hasPermission ? '✅' : '❌'} ${permission}: ${hasPermission ? 'GRANTED' : 'NOT GRANTED'}`);
      });
    }

    console.log('\n🎯 Test Summary:');
    if (insightsTestData.error) {
      console.log('❌ Token still lacks proper permissions for conversion tracking');
      console.log('🔧 Need to generate token with ads_read or ads_management permissions');
    } else {
      console.log('✅ Token has proper permissions for conversion tracking');
      console.log('🔧 Conversion tracking should now work properly');
    }

  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testHavetToken(); 