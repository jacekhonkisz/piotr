#!/usr/bin/env node

require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAdminAccess() {
  console.log('🔍 VERIFYING ADMIN ACCESS TO ALL CLIENTS\n');
  
  try {
    // 1. Check admin users
    console.log('1️⃣ Checking admin users...');
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('role', 'admin');
    
    if (adminError) {
      console.error('❌ Error fetching admins:', adminError);
      return;
    }
    
    console.log(`✅ Found ${admins.length} admin user(s):`);
    admins.forEach(admin => {
      console.log(`   • ${admin.email} (${admin.full_name || 'No name'})`);
    });
    
    if (admins.length === 0) {
      console.log('❌ No admin users found!');
      return;
    }
    
    const mainAdmin = admins[0];
    console.log(`\n🎯 Using admin: ${mainAdmin.email}\n`);
    
    // 2. Check clients assigned to admin
    console.log('2️⃣ Checking clients assigned to admin...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select(`
        id, name, email, company, api_status, 
        ad_account_id, reporting_frequency, 
        created_at, last_report_date,
        generated_username, generated_password,
        contact_emails, notes
      `)
      .eq('admin_id', mainAdmin.id)
      .order('name');
    
    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }
    
    console.log(`✅ Found ${clients.length} clients assigned to admin:`);
    console.log('='.repeat(80));
    
    const spreadsheetClients = [
      'Arche Dwór Uphagena Gdańsk', 'Hotel Artis Loft', 'Blue & Green Baltic Kołobrzeg',
      'Blue & Green Mazury', 'Cesarskie Ogrody', 'Hotel Diva SPA Kołobrzeg',
      'Hotel Lambert Ustronie Morskie', 'Apartamenty Lambert', 'Hotel Tobaco Łódź',
      'Hotel Zalewski Mrzeżyno', 'Młyn Klekotki', 'Sandra SPA Karpacz', 'Nickel Resort Grzybowo'
    ];
    
    let newlyAdded = 0;
    
    clients.forEach((client, i) => {
      const isNewlyAdded = spreadsheetClients.includes(client.name);
      if (isNewlyAdded) newlyAdded++;
      
      console.log(`${i+1}. ${client.name} ${isNewlyAdded ? '🆕' : '🔧'}`);
      console.log(`   📧 Email: ${client.email}`);
      console.log(`   🏢 Company: ${client.company || 'N/A'}`);
      console.log(`   🏢 Ad Account: ${client.ad_account_id}`);
      console.log(`   ✅ Status: ${client.api_status}`);
      console.log(`   📅 Created: ${new Date(client.created_at).toLocaleDateString()}`);
      console.log(`   🔐 Login: ${client.generated_username} / ${client.generated_password}`);
      console.log(`   📊 Frequency: ${client.reporting_frequency}`);
      if (client.contact_emails && client.contact_emails.length > 0) {
        console.log(`   📬 Contact emails: ${client.contact_emails.join(', ')}`);
      }
      if (client.notes) {
        console.log(`   📝 Notes: ${client.notes.substring(0, 100)}...`);
      }
      console.log('');
    });
    
    // 3. Check client profiles
    console.log('3️⃣ Checking client profiles in auth system...');
    const { data: clientProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, created_at')
      .eq('role', 'client')
      .order('email');
    
    if (profileError) {
      console.error('❌ Error fetching client profiles:', profileError);
      return;
    }
    
    console.log(`✅ Found ${clientProfiles.length} client profiles:`);
    clientProfiles.forEach((profile, i) => {
      const matchingClient = clients.find(c => c.email === profile.email);
      console.log(`${i+1}. ${profile.email} ${matchingClient ? '✅' : '⚠️'}`);
      console.log(`   👤 Name: ${profile.full_name || 'N/A'}`);
      console.log(`   📅 Created: ${new Date(profile.created_at).toLocaleDateString()}`);
      if (!matchingClient) {
        console.log(`   ⚠️  No matching client record found!`);
      }
      console.log('');
    });
    
    // 4. Summary
    console.log('='.repeat(80));
    console.log('📊 ADMIN ACCESS VERIFICATION SUMMARY:');
    console.log(`   👨‍💼 Admin users: ${admins.length}`);
    console.log(`   🏢 Total clients visible to admin: ${clients.length}`);
    console.log(`   🆕 Newly added from spreadsheet: ${newlyAdded}`);
    console.log(`   👤 Client profiles in auth: ${clientProfiles.length}`);
    console.log(`   ✅ Clients with matching profiles: ${clients.filter(c => clientProfiles.find(p => p.email === c.email)).length}`);
    
    // 5. Check if admin can access client data
    console.log('\n4️⃣ Testing admin API access simulation...');
    
    // Simulate what the admin page would see
    const adminViewData = {
      totalClients: clients.length,
      activeClients: clients.filter(c => c.api_status === 'valid').length,
      clientsWithTokens: clients.filter(c => c.ad_account_id).length,
      recentlyAdded: clients.filter(c => {
        const createdDate = new Date(c.created_at);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return createdDate > oneDayAgo;
      }).length
    };
    
    console.log('✅ Admin dashboard would show:');
    console.log(`   📊 Total clients: ${adminViewData.totalClients}`);
    console.log(`   ✅ Active clients: ${adminViewData.activeClients}`);
    console.log(`   🔑 Clients with tokens: ${adminViewData.clientsWithTokens}`);
    console.log(`   🆕 Recently added (24h): ${adminViewData.recentlyAdded}`);
    
    console.log('\n🎉 Admin access verification completed!');
    console.log('\n💡 All newly added clients should be visible in the admin panel at /admin');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

verifyAdminAccess();
