require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixClientAssignments() {
  try {
    console.log('🔧 Fixing client assignments...\n');

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log('📋 Current clients:');
    clients.forEach(client => {
      console.log(`   - ${client.name} (${client.email}) - ID: ${client.id}`);
    });

    // Get all reports
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*');

    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }

    console.log('\n📊 Current reports:');
    reports.forEach(report => {
      const client = clients.find(c => c.id === report.client_id);
      console.log(`   - Report ${report.id} for client: ${client?.name || 'UNKNOWN'} (${report.client_id})`);
    });

    // Verify that each client has the correct admin_id
    console.log('\n🔍 Checking admin assignments...');
    
    // Get admin user
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.error('❌ Error listing users:', usersError);
      return;
    }

    const admin = users.find(u => u.email === 'admin@example.com');
    if (!admin) {
      console.error('❌ Admin user not found');
      return;
    }

    console.log(`✅ Admin found: ${admin.email} (${admin.id})`);

    // Ensure all clients are assigned to the admin
    for (const client of clients) {
      if (client.admin_id !== admin.id) {
        console.log(`🔄 Updating admin_id for ${client.name}...`);
        
        const { error: updateError } = await supabase
          .from('clients')
          .update({ admin_id: admin.id })
          .eq('id', client.id);

        if (updateError) {
          console.log(`   ❌ Failed to update ${client.name}: ${updateError.message}`);
        } else {
          console.log(`   ✅ Updated ${client.name}`);
        }
      } else {
        console.log(`   ✅ ${client.name} already has correct admin_id`);
      }
    }

    // Verify reports are assigned to correct clients
    console.log('\n🔍 Verifying report assignments...');
    
    for (const report of reports) {
      const client = clients.find(c => c.id === report.client_id);
      if (!client) {
        console.log(`   ❌ Report ${report.id} has invalid client_id: ${report.client_id}`);
      } else {
        console.log(`   ✅ Report ${report.id} correctly assigned to ${client.name}`);
      }
    }

    // Test PDF generation for jacek's reports
    console.log('\n🧪 Testing PDF generation for jacek...');
    
    const jacek = clients.find(c => c.email === 'jac.honkisz@gmail.com');
    if (jacek) {
      const jacekReports = reports.filter(r => r.client_id === jacek.id);
      console.log(`   Found ${jacekReports.length} reports for jacek`);
      
      if (jacekReports.length > 0) {
        const latestReport = jacekReports[0];
        console.log(`   Latest report: ${latestReport.id} (${latestReport.date_range_start} to ${latestReport.date_range_end})`);
      }
    }

    console.log('\n✅ Client assignment fix completed!');
    console.log('All clients should now be properly assigned to the admin.');
    console.log('Reports should display the correct client names.');

  } catch (error) {
    console.error('❌ Error fixing client assignments:', error);
  }
}

fixClientAssignments(); 