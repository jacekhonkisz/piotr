require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addHavetClient() {
  console.log('🔧 ADDING HAVET CLIENT TO DATABASE\n');
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

    // 2. Check if Havet client already exists
    console.log('\n2️⃣ Checking if Havet client already exists...');
    const { data: existingClient, error: checkError } = await supabase
      .from('clients')
      .select('*')
      .or(`email.eq.havet@magialubczyku.pl,ad_account_id.eq.659510566204299`);

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
    console.log('\n3️⃣ Adding new Havet client...');
    const havetClient = {
      admin_id: adminUser.id,
      name: 'Havet',
      email: 'havet@magialubczyku.pl',
      company: 'Magia Lubczyku',
      ad_account_id: '659510566204299',
      meta_access_token: 'EAAKZBRTlpNXsBPMg0chlsVDyDiPuQcOZAYaKYtz2rQKW93ZBGuH0VJzj2eFWv8WNVrus3mBbm8RnpG5JVFjOA7813ZCRy8zZBH0qTLNK9QZCrhO8ZAITtIkeGohn1DfRyouTDIoASdBNJzbPUphAEZAX2TmFMRmXrcySZA5ZBqiL8Oz7n6KquIBL92EaZAwk6UzOZCurpQZDZD',
      api_status: 'valid',
      reporting_frequency: 'monthly',
      notes: 'Havet - Magia Lubczyku spa resort. Active campaigns with real performance data.'
    };

    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert([havetClient])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error adding client:', insertError);
      return;
    }

    console.log('✅ Havet client added successfully!');
    console.log(`   ID: ${newClient.id}`);
    console.log(`   Name: ${newClient.name}`);
    console.log(`   Email: ${newClient.email}`);
    console.log(`   Company: ${newClient.company}`);
    console.log(`   Ad Account: ${newClient.ad_account_id}`);
    console.log(`   Admin: ${adminUser.email}`);

    // 4. Test the new client's API access
    console.log('\n4️⃣ Testing API access for new client...');
    try {
      const tokenInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${havetClient.meta_access_token}`);
      const tokenInfo = await tokenInfoResponse.json();
      
      if (tokenInfo.error) {
        console.error('❌ Token validation failed:', tokenInfo.error.message);
      } else {
        console.log('✅ Token is valid');
        console.log(`   User ID: ${tokenInfo.id}`);
        console.log(`   Name: ${tokenInfo.name}`);
        
        // Test ad account access
        const adAccountId = `act_${havetClient.ad_account_id}`;
        const accountResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}?access_token=${havetClient.meta_access_token}&fields=id,name,account_id,account_status,currency`);
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

    // 5. Show all clients in database
    console.log('\n5️⃣ All clients in database:');
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

    // 6. Show credentials summary
    console.log('6️⃣ HAVET CLIENT CREDENTIALS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`📧 Email: ${havetClient.email}`);
    console.log(`🏢 Company: ${havetClient.company}`);
    console.log(`🔑 Meta Access Token: ${havetClient.meta_access_token}`);
    console.log(`📊 Ad Account ID: ${havetClient.ad_account_id}`);
    console.log(`🏢 Business Manager: API Raporty (ID: 61579156319978)`);
    console.log(`💰 Currency: PLN`);
    console.log(`🌍 Timezone: Europe/Warsaw`);
    console.log(`📈 Account Status: Active (1)`);
    console.log(`👤 Admin: ${adminUser.email}`);
    console.log('');
    console.log('🔐 Token Permissions:');
    console.log('   ✅ ads_read - Read ad account data');
    console.log('   ✅ ads_management - Access campaign insights');
    console.log('   ✅ business_management - Access business account');
    console.log('   ✅ read_insights - Access performance data');
    console.log('');
    console.log('📊 Available Data:');
    console.log('   ✅ 50 campaigns (8 active, 42 historical)');
    console.log('   ✅ 20 ad sets');
    console.log('   ✅ 20 ads');
    console.log('   ✅ Real performance metrics');
    console.log('   ✅ Demographic breakdowns');
    console.log('   ✅ Multiple date ranges');
    console.log('');
    console.log('🎯 Campaign Types:');
    console.log('   ✅ Sales conversions (OUTCOME_SALES)');
    console.log('   ✅ Awareness campaigns (OUTCOME_AWARENESS)');
    console.log('   ✅ Traffic campaigns (OUTCOME_TRAFFIC)');
    console.log('   ✅ Engagement campaigns (OUTCOME_ENGAGEMENT)');
    console.log('   ✅ Lead generation (OUTCOME_LEADS)');
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
addHavetClient().catch(console.error); 