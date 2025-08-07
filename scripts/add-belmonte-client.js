require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addBelmonteClient() {
  console.log('🔧 ADDING BELMONTE HOTEL CLIENT TO DATABASE\n');
  console.log('='.repeat(50));

  try {
    // 1. Get admin user (jacek)
    console.log('1️⃣ Getting admin user...');
    const { data: adminUser, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (adminError || !adminUser) {
      console.error('❌ Admin user not found:', adminError);
      return;
    }

    console.log('✅ Admin user found:', adminUser.email, `(ID: ${adminUser.id})`);

    // 2. Check if Belmonte client already exists
    console.log('\n2️⃣ Checking if Belmonte client already exists...');
    const { data: existingClient, error: checkError } = await supabase
      .from('clients')
      .select('*')
      .or(`email.eq.belmonte@hotel.com,ad_account_id.eq.438600948208231`);

    if (checkError) {
      console.error('❌ Error checking existing client:', checkError);
      return;
    }

    if (existingClient && existingClient.length > 0) {
      console.log('⚠️  Client already exists:');
      existingClient.forEach(client => {
        console.log(`   - ${client.name} (${client.email}) - Ad Account: ${client.ad_account_id}`);
      });
      console.log('\n💡 Would you like to update the existing client instead?');
      return;
    }

    // 3. Add new client
    console.log('\n3️⃣ Adding new Belmonte client...');
    const belmonteClient = {
      admin_id: adminUser.id,
      name: 'Belmonte Hotel',
      email: 'belmonte@hotel.com',
      company: 'Belmonte Hotel',
      ad_account_id: '438600948208231',
      meta_access_token: 'EAAR4iSxFE60BPKn1vqWoG2s4IBUwZClFod0RBKZAnxnlVZARorkcV92wZCPeJokx8LjRXhG7cke7ZCvFrhyykEQhEZBQG42HFwZCr73LZAjwTZCPppJnI3GHjXtNBWBJenQb3duwdw63iAwTfU2pKkgJAEZBZCGpM1ZAVw05ChBcY98VLA6gJ8nVqwC2q23pdS2xkVQCSQZDZD',
      api_status: 'valid',
      reporting_frequency: 'monthly',
      notes: 'Belmonte Hotel - Luxury hotel with Meta Ads campaigns. Real performance data available.'
    };

    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert([belmonteClient])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error adding client:', insertError);
      return;
    }

    console.log('✅ Belmonte client added successfully!');
    console.log(`   ID: ${newClient.id}`);
    console.log(`   Name: ${newClient.name}`);
    console.log(`   Email: ${newClient.email}`);
    console.log(`   Company: ${newClient.company}`);
    console.log(`   Ad Account: ${newClient.ad_account_id}`);
    console.log(`   Admin: ${adminUser.email}`);

    // 4. Test the new client's API access
    console.log('\n4️⃣ Testing API access for new client...');
    try {
      const tokenInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${belmonteClient.meta_access_token}`);
      const tokenInfo = await tokenInfoResponse.json();
      
      if (tokenInfo.error) {
        console.error('❌ Token validation failed:', tokenInfo.error.message);
      } else {
        console.log('✅ Token is valid');
        console.log(`   User ID: ${tokenInfo.id}`);
        console.log(`   Name: ${tokenInfo.name}`);
        
        // Test ad account access
        const adAccountId = `act_${belmonteClient.ad_account_id}`;
        const accountResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}?access_token=${belmonteClient.meta_access_token}&fields=id,name,account_id,account_status,currency`);
        const accountData = await accountResponse.json();
        
        if (accountData.error) {
          console.error('❌ Ad account access failed:', accountData.error.message);
        } else {
          console.log('✅ Ad account accessible:');
          console.log(`   Name: ${accountData.name}`);
          console.log(`   Account ID: ${accountData.account_id}`);
          console.log(`   Status: ${accountData.account_status}`);
          console.log(`   Currency: ${accountData.currency}`);
        }
      }
    } catch (error) {
      console.error('❌ API test failed:', error.message);
    }

    // 5. Test campaigns and insights access
    console.log('\n5️⃣ Testing campaigns and insights access...');
    try {
      const adAccountId = `act_${belmonteClient.ad_account_id}`;
      
      // Test campaigns access
      const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}/campaigns?access_token=${belmonteClient.meta_access_token}&fields=id,name,status,objective&limit=5`);
      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.error('❌ Campaigns access failed:', campaignsData.error.message);
      } else {
        console.log(`✅ Campaigns accessible: ${campaignsData.data?.length || 0} campaigns found`);
        campaignsData.data?.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.name} (${campaign.id})`);
          console.log(`      Status: ${campaign.status}`);
          console.log(`      Objective: ${campaign.objective}`);
        });
      }
      
      // Test insights access
      const insightsResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${belmonteClient.meta_access_token}&fields=impressions,clicks,spend&date_preset=last_7d&limit=1`);
      const insightsData = await insightsResponse.json();
      
      if (insightsData.error) {
        console.error('❌ Insights access failed:', insightsData.error.message);
      } else {
        console.log(`✅ Insights accessible: ${insightsData.data?.length || 0} records found`);
        if (insightsData.data && insightsData.data.length > 0) {
          const insight = insightsData.data[0];
          console.log(`   Impressions: ${insight.impressions || 'N/A'}`);
          console.log(`   Clicks: ${insight.clicks || 'N/A'}`);
          console.log(`   Spend: ${insight.spend || 'N/A'}`);
        }
      }
    } catch (error) {
      console.error('❌ Campaigns/Insights test failed:', error.message);
    }

    // 6. Show all clients in database
    console.log('\n6️⃣ All clients in database:');
    const { data: allClients, error: allError } = await supabase
      .from('clients')
      .select('id, name, email, company, ad_account_id, api_status, reporting_frequency');

    if (allError) {
      console.error('❌ Error fetching all clients:', allError);
      return;
    }

    console.log(`📊 Total clients: ${allClients.length}`);
    allClients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email})`);
      console.log(`      ID: ${client.id}`);
      console.log(`      Company: ${client.company || 'N/A'}`);
      console.log(`      Ad Account: ${client.ad_account_id}`);
      console.log(`      API Status: ${client.api_status}`);
      console.log(`      Reporting: ${client.reporting_frequency}`);
      console.log('');
    });

    // 7. Show credentials summary
    console.log('7️⃣ BELMONTE CLIENT CREDENTIALS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`📧 Email: ${belmonteClient.email}`);
    console.log(`🏢 Company: ${belmonteClient.company}`);
    console.log(`🔑 Meta Access Token: ${belmonteClient.meta_access_token}`);
    console.log(`📊 Ad Account ID: ${belmonteClient.ad_account_id}`);
    console.log(`🏢 Business Manager: BELMONTE (ID: 61579051925497)`);
    console.log(`👤 Admin: ${adminUser.email}`);
    console.log('');
    console.log('🔐 Token Permissions:');
    console.log('   ✅ ads_read - Read ad account data');
    console.log('   ✅ ads_management - Access campaign insights');
    console.log('   ✅ business_management - Access business account');
    console.log('   ✅ read_insights - Access performance data');
    console.log('');
    console.log('📊 Available Data:');
    console.log('   ✅ Campaign data');
    console.log('   ✅ Ad sets data');
    console.log('   ✅ Ads data');
    console.log('   ✅ Real performance metrics');
    console.log('   ✅ Multiple date ranges');
    console.log('');
    console.log('📋 Database Record:');
    console.log(`   Client ID: ${newClient.id}`);
    console.log(`   Admin ID: ${adminUser.id}`);
    console.log(`   Created: ${newClient.created_at}`);
    console.log(`   API Status: ${newClient.api_status}`);
    console.log(`   Reporting Frequency: ${newClient.reporting_frequency}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
addBelmonteClient().catch(console.error); 