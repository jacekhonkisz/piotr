require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicateReports() {
  try {
    console.log('🔍 Checking for duplicate reports...\n');
    
    // Get the TechCorp client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'client@techcorp.com')
      .single();
    
    if (clientError || !client) {
      console.error('❌ TechCorp client not found:', clientError);
      return;
    }
    
    console.log('📋 TechCorp client:', client.name);
    console.log(`   - ID: ${client.id}`);
    
    // Check for existing reports for this client
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    
    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }
    
    console.log(`\n📊 Found ${reports.length} reports for TechCorp:`);
    
    reports.forEach((report, index) => {
      console.log(`\n${index + 1}. Report ID: ${report.id}`);
      console.log(`   - Date Range: ${report.date_range_start} to ${report.date_range_end}`);
      console.log(`   - Generated: ${report.generated_at}`);
      console.log(`   - Generation Time: ${report.generation_time_ms}ms`);
      console.log(`   - Email Sent: ${report.email_sent}`);
    });
    
    // Check for specific date range that we're trying to insert
    const targetStartDate = '2024-01-01';
    const targetEndDate = '2024-12-31';
    
    console.log(`\n🎯 Checking for existing report with date range: ${targetStartDate} to ${targetEndDate}`);
    
    const existingReport = reports.find(report => 
      report.date_range_start === targetStartDate && 
      report.date_range_end === targetEndDate
    );
    
    if (existingReport) {
      console.log('❌ DUPLICATE FOUND!');
      console.log(`   - Report ID: ${existingReport.id}`);
      console.log(`   - Created: ${existingReport.created_at}`);
      console.log(`   - This is why the insert is failing!`);
      
      // Show the exact constraint violation
      console.log('\n💡 The database has a UNIQUE constraint on (client_id, date_range_start, date_range_end)');
      console.log('💡 Solution: Either use a different date range or delete the existing report');
      
      // Option to delete the duplicate
      console.log('\n🗑️  Would you like to delete this duplicate report? (y/n)');
      // In a real script, you'd prompt for user input here
      
    } else {
      console.log('✅ No duplicate found for this date range');
      console.log('💡 The issue might be something else in the database insert');
    }
    
    // Check the campaigns table for this client
    console.log('\n📈 Checking campaigns table...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
    } else {
      console.log(`Found ${campaigns.length} campaign records for TechCorp`);
      campaigns.forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.campaign_name} (${campaign.campaign_id})`);
        console.log(`      - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
        console.log(`      - Spend: $${campaign.spend}`);
        console.log(`      - Impressions: ${campaign.impressions}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error checking duplicate reports:', error);
  }
}

// Run the check
checkDuplicateReports(); 