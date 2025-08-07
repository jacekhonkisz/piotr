const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugDashboardUser() {
  console.log('🔍 Debugging Dashboard User and Client Data...\n');

  try {
    // Get all users to see who might be logged in
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`📊 Found ${users.users.length} users in the system\n`);

    // Check each user and their associated client
    for (const user of users.users) {
      console.log(`👤 User: ${user.email} (ID: ${user.id})`);
      console.log(`   Role: ${user.user_metadata?.role || 'user'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
      
      // Get client data for this user
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq(user.user_metadata?.role === 'admin' ? 'admin_id' : 'email', 
            user.user_metadata?.role === 'admin' ? user.id : user.email)
        .single();

      if (clientError) {
        console.log(`   ❌ No client found for this user`);
      } else {
        console.log(`   ✅ Client: ${clientData.name} (${clientData.email})`);
        console.log(`   Client ID: ${clientData.id}`);
        
        // Get campaigns for this client
        const { data: campaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', clientData.id);

        if (campaignsError) {
          console.log(`   ❌ Error fetching campaigns: ${campaignsError.message}`);
        } else {
          console.log(`   📊 Campaigns: ${campaigns?.length || 0}`);
          
          if (campaigns && campaigns.length > 0) {
            // Check for conversion data
            const hasConversionData = campaigns.some(campaign => 
              (campaign.click_to_call && campaign.click_to_call > 0) ||
              (campaign.lead && campaign.lead > 0) ||
              (campaign.purchase && campaign.purchase > 0)
            );
            
            console.log(`   🎯 Has Conversion Data: ${hasConversionData ? '✅ YES' : '❌ NO'}`);
            
            if (hasConversionData) {
              const sampleCampaign = campaigns.find(c => 
                (c.click_to_call && c.click_to_call > 0) ||
                (c.lead && c.lead > 0) ||
                (c.purchase && c.purchase > 0)
              );
              
              console.log(`   📈 Sample conversion data:`);
              console.log(`      - Click to Call: ${sampleCampaign.click_to_call || 0}`);
              console.log(`      - Lead: ${sampleCampaign.lead || 0}`);
              console.log(`      - Purchase: ${sampleCampaign.purchase || 0}`);
              console.log(`      - Booking Step 1: ${sampleCampaign.booking_step_1 || 0}`);
            }
          }
        }
      }
      
      console.log('');
    }

    // Check which user is most likely to be the current user (most recent sign in)
    const activeUsers = users.users.filter(u => u.last_sign_in_at).sort((a, b) => 
      new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at)
    );

    if (activeUsers.length > 0) {
      console.log('🎯 MOST LIKELY CURRENT USER:');
      console.log(`   Email: ${activeUsers[0].email}`);
      console.log(`   Role: ${activeUsers[0].user_metadata?.role || 'user'}`);
      console.log(`   Last Sign In: ${activeUsers[0].last_sign_in_at}`);
      
      // Get client for this user
      const { data: currentClient, error: currentClientError } = await supabase
        .from('clients')
        .select('*')
        .eq(activeUsers[0].user_metadata?.role === 'admin' ? 'admin_id' : 'email', 
            activeUsers[0].user_metadata?.role === 'admin' ? activeUsers[0].id : activeUsers[0].email)
        .single();

      if (currentClientError) {
        console.log(`   ❌ No client found for current user`);
      } else {
        console.log(`   ✅ Current Client: ${currentClient.name} (${currentClient.email})`);
        
        // Get campaigns for current client
        const { data: currentCampaigns, error: currentCampaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', currentClient.id);

        if (currentCampaignsError) {
          console.log(`   ❌ Error fetching campaigns: ${currentCampaignsError.message}`);
        } else {
          console.log(`   📊 Current Client Campaigns: ${currentCampaigns?.length || 0}`);
          
          if (currentCampaigns && currentCampaigns.length > 0) {
            const conversionTotals = currentCampaigns.reduce((acc, campaign) => ({
              click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
              lead: acc.lead + (campaign.lead || 0),
              purchase: acc.purchase + (campaign.purchase || 0),
              purchase_value: acc.purchase_value + (campaign.purchase_value || 0),
              booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
              booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
              booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
            }), {
              click_to_call: 0,
              lead: 0,
              purchase: 0,
              purchase_value: 0,
              booking_step_1: 0,
              booking_step_2: 0,
              booking_step_3: 0
            });

            console.log(`   📊 Current Client Conversion Data:`);
            console.log(`      - Click to Call: ${conversionTotals.click_to_call}`);
            console.log(`      - Lead: ${conversionTotals.lead}`);
            console.log(`      - Purchase: ${conversionTotals.purchase}`);
            console.log(`      - Purchase Value: ${conversionTotals.purchase_value}`);
            console.log(`      - Booking Step 1: ${conversionTotals.booking_step_1}`);
            console.log(`      - Booking Step 2: ${conversionTotals.booking_step_2}`);
            console.log(`      - Booking Step 3: ${conversionTotals.booking_step_3}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugDashboardUser(); 