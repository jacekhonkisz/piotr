require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addConversionColumns() {
  console.log('🔧 Adding conversion tracking columns to campaigns table...\n');

  try {
    // SQL to add conversion tracking columns
    const sql = `
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS click_to_call BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lead BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS purchase BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS purchase_value DECIMAL(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS booking_step_1 BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS booking_step_2 BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS booking_step_3 BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS roas DECIMAL(8,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cost_per_reservation DECIMAL(8,2) DEFAULT 0;
    `;

    // Execute the SQL using rpc
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.log(`❌ Error adding columns: ${error.message}`);
      
      // Try alternative approach - check if columns exist
      console.log('\n🔍 Checking if columns already exist...');
      const { data: columns, error: checkError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'campaigns')
        .eq('table_schema', 'public');

      if (checkError) {
        console.log(`❌ Error checking columns: ${checkError.message}`);
      } else {
        const columnNames = columns.map(col => col.column_name);
        console.log('📋 Existing columns in campaigns table:');
        columnNames.forEach(col => console.log(`   - ${col}`));
        
        const conversionColumns = ['click_to_call', 'lead', 'purchase', 'purchase_value', 'booking_step_1', 'booking_step_2', 'booking_step_3', 'roas', 'cost_per_reservation'];
        const missingColumns = conversionColumns.filter(col => !columnNames.includes(col));
        
        if (missingColumns.length === 0) {
          console.log('✅ All conversion tracking columns already exist!');
        } else {
          console.log('❌ Missing columns:', missingColumns.join(', '));
        }
      }
    } else {
      console.log('✅ Successfully added conversion tracking columns');
    }

    // Test inserting a campaign with conversion data
    console.log('\n🧪 Testing campaign insertion with conversion data...');
    
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('name', 'Havet')
      .single();

    if (client) {
      const testCampaign = {
        client_id: client.id,
        campaign_id: 'test_conversion_campaign',
        campaign_name: 'Test Conversion Campaign',
        status: 'ACTIVE',
        date_range_start: '2024-01-01',
        date_range_end: '2024-12-31',
        impressions: 1000,
        clicks: 100,
        spend: 500.00,
        conversions: 10,
        ctr: 10.00,
        cpc: 5.00,
        // Conversion tracking data
        click_to_call: 25,
        lead: 15,
        purchase: 10,
        purchase_value: 2500.00,
        booking_step_1: 30,
        booking_step_2: 20,
        booking_step_3: 10,
        roas: 5.00,
        cost_per_reservation: 50.00
      };

      const { error: insertError } = await supabase
        .from('campaigns')
        .insert(testCampaign);

      if (insertError) {
        console.log(`❌ Error inserting test campaign: ${insertError.message}`);
      } else {
        console.log('✅ Successfully inserted test campaign with conversion data');
        
        // Clean up test data
        await supabase
          .from('campaigns')
          .delete()
          .eq('campaign_id', 'test_conversion_campaign');
        
        console.log('🧹 Cleaned up test data');
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Run the force-fresh-dashboard-data.js script again');
    console.log('2. Refresh the dashboard in your browser');
    console.log('3. Conversion tracking should now work properly');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

addConversionColumns(); 