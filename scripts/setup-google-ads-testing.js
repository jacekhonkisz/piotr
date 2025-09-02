#!/usr/bin/env node

/**
 * Setup Google Ads Testing Environment
 * This script creates the Google Ads table and adds sample data for testing
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupGoogleAdsTesting() {
  console.log('🚀 Setting up Google Ads testing environment...');

  try {
    // Step 1: Create the Google Ads table
    console.log('📝 Creating google_ads_campaigns table...');
    
    const sqlPath = path.join(__dirname, 'create-google-ads-table.sql');
    const createTableSQL = fs.readFileSync(sqlPath, 'utf8');
    
    const { error: tableError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });

    if (tableError) {
      console.error('❌ Error creating table:', tableError);
      // Try alternative approach - execute SQL directly
      console.log('🔄 Trying alternative approach...');
      
      // Split SQL into individual statements and execute them
      const statements = createTableSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        if (statement.toLowerCase().includes('create table')) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error && !error.message?.includes('already exists')) {
            console.error('❌ Error executing statement:', error);
          }
        }
      }
    }

    console.log('✅ Table creation completed');

    // Step 2: Find the Belmonte Hotel client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', '%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Could not find Belmonte Hotel client:', clientError);
      return;
    }

    console.log(`✅ Found client: ${client.name} (ID: ${client.id})`);

    // Step 3: Enable Google Ads for this client
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        google_ads_enabled: true,
        google_ads_customer_id: '123-456-7890', // Sample Customer ID
        google_ads_refresh_token: 'sample_refresh_token_for_testing'
      })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Error enabling Google Ads:', updateError);
      return;
    }

    console.log('✅ Enabled Google Ads for client');

    // Step 4: Add sample Google Ads campaigns for August 2025
    const sampleCampaigns = [
      {
        client_id: client.id,
        campaign_id: 'google_camp_001',
        campaign_name: 'Belmonte Hotel - Search Ads',
        status: 'ENABLED',
        date_range_start: '2025-08-01',
        date_range_end: '2025-08-31',
        spend: 8500.00,
        impressions: 125000,
        clicks: 3200,
        cpc: 2.66,
        ctr: 2.56,
        form_submissions: 45,
        phone_calls: 28,
        email_clicks: 12,
        phone_clicks: 35,
        booking_step_1: 85,
        booking_step_2: 62,
        booking_step_3: 48,
        reservations: 42,
        reservation_value: 25200.00,
        roas: 2.96
      },
      {
        client_id: client.id,
        campaign_id: 'google_camp_002',
        campaign_name: 'Belmonte Hotel - Display Network',
        status: 'ENABLED',
        date_range_start: '2025-08-01',
        date_range_end: '2025-08-31',
        spend: 4200.00,
        impressions: 89000,
        clicks: 1800,
        cpc: 2.33,
        ctr: 2.02,
        form_submissions: 22,
        phone_calls: 15,
        email_clicks: 8,
        phone_clicks: 18,
        booking_step_1: 45,
        booking_step_2: 32,
        booking_step_3: 25,
        reservations: 22,
        reservation_value: 13200.00,
        roas: 3.14
      },
      {
        client_id: client.id,
        campaign_id: 'google_camp_003',
        campaign_name: 'Belmonte Hotel - YouTube Ads',
        status: 'ENABLED',
        date_range_start: '2025-08-01',
        date_range_end: '2025-08-31',
        spend: 3100.00,
        impressions: 156000,
        clicks: 2400,
        cpc: 1.29,
        ctr: 1.54,
        form_submissions: 18,
        phone_calls: 12,
        email_clicks: 5,
        phone_clicks: 15,
        booking_step_1: 38,
        booking_step_2: 28,
        booking_step_3: 20,
        reservations: 18,
        reservation_value: 10800.00,
        roas: 3.48
      }
    ];

    // Step 5: Insert sample campaigns using individual inserts
    console.log('📝 Inserting sample campaigns...');
    
    for (const campaign of sampleCampaigns) {
      const { error: insertError } = await supabase
        .from('google_ads_campaigns')
        .upsert(campaign, { 
          onConflict: 'client_id,campaign_id,date_range_start,date_range_end' 
        });

      if (insertError) {
        console.error(`❌ Error inserting campaign ${campaign.campaign_name}:`, insertError);
      } else {
        console.log(`✅ Inserted campaign: ${campaign.campaign_name}`);
      }
    }

    // Calculate totals
    const totalSpend = sampleCampaigns.reduce((sum, camp) => sum + camp.spend, 0);
    const totalImpressions = sampleCampaigns.reduce((sum, camp) => sum + camp.impressions, 0);
    const totalClicks = sampleCampaigns.reduce((sum, camp) => sum + camp.clicks, 0);
    const totalReservations = sampleCampaigns.reduce((sum, camp) => sum + camp.reservations, 0);
    const totalReservationValue = sampleCampaigns.reduce((sum, camp) => sum + camp.reservation_value, 0);

    console.log('\n📊 Sample Google Ads Data Summary:');
    console.log(`   Total Spend: ${totalSpend.toFixed(2)} PLN`);
    console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log(`   Total Reservations: ${totalReservations}`);
    console.log(`   Total Reservation Value: ${totalReservationValue.toFixed(2)} PLN`);
    console.log(`   Overall ROAS: ${(totalReservationValue / totalSpend).toFixed(2)}x`);

    console.log('\n🎉 Google Ads testing environment setup complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Go to the Belmonte Hotel dashboard');
    console.log('2. Click "Pobierz PDF (Meta + Google)" button');
    console.log('3. You should now see a unified report with both Meta and Google Ads data');
    console.log('4. The PDF will include:');
    console.log('   - Combined KPIs on cover page');
    console.log('   - Platform comparison section');
    console.log('   - Separate campaign tables for Meta and Google');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
if (require.main === module) {
  setupGoogleAdsTesting().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { setupGoogleAdsTesting };
