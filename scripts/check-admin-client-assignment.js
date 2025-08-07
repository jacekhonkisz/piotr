const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdminClientAssignment() {
  console.log('🔍 Checking admin client assignment...\n');

  try {
    // Get the admin user
    const { data: adminUser, error: adminError } = await supabase.auth.admin.listUsers();
    
    if (adminError) {
      console.error('❌ Error fetching admin user:', adminError);
      return;
    }

    const admin = adminUser.users.find(u => u.email === 'admin@example.com');
    if (!admin) {
      console.error('❌ Admin user not found');
      return;
    }

    console.log(`👤 Admin user: ${admin.email} (ID: ${admin.id})`);

    // Check if any client has this admin_id
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', admin.id);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📊 Clients assigned to admin: ${clients?.length || 0}`);

    if (clients && clients.length > 0) {
      for (const client of clients) {
        console.log(`   ✅ ${client.name} (${client.email}) - ID: ${client.id}`);
        
        // Get campaigns for this client
        const { data: campaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', client.id);

        if (campaignsError) {
          console.log(`   ❌ Error fetching campaigns: ${campaignsError.message}`);
        } else {
          console.log(`   📊 Campaigns: ${campaigns?.length || 0}`);
          
          if (campaigns && campaigns.length > 0) {
            const conversionTotals = campaigns.reduce((acc, campaign) => ({
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

            console.log(`   📊 Conversion Data:`);
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
    } else {
      console.log('❌ No clients assigned to admin');
      
      // Check all clients to see their admin_id
      const { data: allClients, error: allClientsError } = await supabase
        .from('clients')
        .select('*');

      if (allClientsError) {
        console.error('❌ Error fetching all clients:', allClientsError);
        return;
      }

      console.log('\n📊 All clients and their admin_id:');
      allClients.forEach(client => {
        console.log(`   ${client.name}: admin_id = ${client.admin_id || 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAdminClientAssignment(); 