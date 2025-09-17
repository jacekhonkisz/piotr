require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comprehensiveConversionAudit() {
  console.log('🔍 COMPREHENSIVE CONVERSION TRACKING AUDIT\n');
  console.log('='.repeat(80));

  try {
    // Get Havet client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'Havet')
      .single();

    if (clientError || !client) {
      console.log('❌ Client not found:', clientError?.message);
      return;
    }

    console.log(`🏨 Client: ${client.name} (${client.email})`);
    console.log(`🏢 Ad Account: ${client.ad_account_id}`);
    console.log(`🔑 Has Meta Token: ${!!client.meta_access_token}`);
    console.log('');

    // AUDIT 1: Database Schema Check
    console.log('🔍 AUDIT 1: DATABASE SCHEMA CHECK');
    console.log('-'.repeat(40));
    
    try {
      const { data: columns, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'campaigns')
        .eq('table_schema', 'public');

      if (schemaError) {
        console.log('❌ Cannot check database schema:', schemaError.message);
      } else {
        const columnNames = columns.map(col => col.column_name);
        console.log(`📋 Campaigns table has ${columnNames.length} columns`);
        
        const conversionColumns = ['click_to_call', 'lead', 'purchase', 'purchase_value', 'booking_step_1', 'booking_step_2', 'booking_step_3'];
        const missingColumns = conversionColumns.filter(col => !columnNames.includes(col));
        
        if (missingColumns.length > 0) {
          console.log('❌ MISSING CONVERSION COLUMNS:', missingColumns.join(', '));
          console.log('   This will prevent conversion data from being saved to database');
        } else {
          console.log('✅ All conversion tracking columns exist');
        }
      }
    } catch (error) {
      console.log('❌ Schema check failed:', error.message);
    }

    // AUDIT 2: Database Data Check
    console.log('\n🔍 AUDIT 2: DATABASE DATA CHECK');
    console.log('-'.repeat(40));
    
    const { data: dbCampaigns, error: dbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .limit(5);

    if (dbError) {
      console.log(`❌ Database error: ${dbError.message}`);
    } else {
      console.log(`📊 Found ${dbCampaigns?.length || 0} campaigns in database`);
      
      if (dbCampaigns && dbCampaigns.length > 0) {
        const sampleCampaign = dbCampaigns[0];
        console.log('📋 Sample campaign from database:');
        console.log(`   - Name: ${sampleCampaign.campaign_name}`);
        console.log(`   - Spend: ${sampleCampaign.spend}`);
        console.log(`   - Impressions: ${sampleCampaign.impressions}`);
        console.log(`   - Clicks: ${sampleCampaign.clicks}`);
        
        // Check if conversion columns exist and have data
        if (sampleCampaign.hasOwnProperty('click_to_call')) {
          console.log(`   - Click to Call: ${sampleCampaign.click_to_call || 'NULL'}`);
          console.log(`   - Lead: ${sampleCampaign.lead || 'NULL'}`);
          console.log(`   - Purchase: ${sampleCampaign.purchase || 'NULL'}`);
          console.log(`   - Booking Step 1: ${sampleCampaign.booking_step_1 || 'NULL'}`);
        } else {
          console.log('   ❌ Conversion tracking columns do not exist in database');
        }
      } else {
        console.log('❌ No campaigns in database - this is why conversion tracking shows "Nie skonfigurowane"');
      }
    }

    // AUDIT 3: Meta API Token Check
    console.log('\n🔍 AUDIT 3: META API TOKEN CHECK');
    console.log('-'.repeat(40));
    
    const token = client.meta_access_token;
    if (!token) {
      console.log('❌ No Meta API token found');
    } else {
      console.log('✅ Meta API token exists');
      
      // Check token permissions
      try {
        const permissionsResponse = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`);
        const permissionsData = await permissionsResponse.json();
        
        if (permissionsData.error) {
          console.log(`❌ Token permissions error: ${permissionsData.error.message}`);
        } else {
          console.log('✅ Token permissions check successful');
          const requiredPermissions = ['ads_read', 'ads_management', 'business_management'];
          
          requiredPermissions.forEach(permission => {
            const hasPermission = permissionsData.data?.some(p => p.permission === permission && p.status === 'granted');
            console.log(`   ${hasPermission ? '✅' : '❌'} ${permission}: ${hasPermission ? 'GRANTED' : 'NOT GRANTED'}`);
          });
        }
      } catch (error) {
        console.log('❌ Token permissions check failed:', error.message);
      }
    }

    // AUDIT 4: Meta API Data Fetch Check
    console.log('\n🔍 AUDIT 4: META API DATA FETCH CHECK');
    console.log('-'.repeat(40));
    
    if (!token) {
      console.log('❌ Cannot test API without token');
    } else {
      const adAccountId = client.ad_account_id;
      const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const startDate = new Date(2024, 0, 1).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${startDate}","until":"${endDate}"}&limit=5&access_token=${token}`
        );
        
        const data = await response.json();
        
        if (data.error) {
          console.log(`❌ Meta API Error: ${data.error.message}`);
          console.log(`   Error Code: ${data.error.code}`);
          console.log(`   Error Subcode: ${data.error.error_subcode}`);
        } else {
          console.log(`✅ Meta API call successful`);
          console.log(`📊 Found ${data.data?.length || 0} campaigns from API`);
          
          if (data.data && data.data.length > 0) {
            const sampleCampaign = data.data[0];
            console.log('📋 Sample campaign from API:');
            console.log(`   - Name: ${sampleCampaign.campaign_name}`);
            console.log(`   - Spend: ${sampleCampaign.spend}`);
            console.log(`   - Impressions: ${sampleCampaign.impressions}`);
            console.log(`   - Clicks: ${sampleCampaign.clicks}`);
            
            // Check for conversion tracking data
            if (sampleCampaign.actions && sampleCampaign.actions.length > 0) {
              console.log(`   - Actions: ${sampleCampaign.actions.length} action types`);
              
              // Parse conversion data
              let click_to_call = 0;
              let lead = 0;
              let purchase = 0;
              let booking_step_1 = 0;

              sampleCampaign.actions.forEach((action) => {
                const actionType = action.action_type;
                const value = parseInt(action.value || '0');
                
                if (actionType.includes('click_to_call')) {
                  click_to_call += value;
                }
                if (actionType.includes('lead')) {
                  lead += value;
                }
                if (actionType === 'purchase' || actionType.includes('purchase')) {
                  purchase += value;
                }
                if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
                  booking_step_1 += value;
                }
              });

              console.log('   📊 Parsed conversion data:');
              console.log(`      - Click to Call: ${click_to_call}`);
              console.log(`      - Lead: ${lead}`);
              console.log(`      - Purchase: ${purchase}`);
              console.log(`      - Booking Step 1: ${booking_step_1}`);
              
              if (click_to_call > 0 || lead > 0 || purchase > 0 || booking_step_1 > 0) {
                console.log('✅ Conversion tracking data is available from Meta API');
              } else {
                console.log('❌ No conversion tracking data found in Meta API response');
              }
            } else {
              console.log('❌ No actions data in API response');
            }
          }
        }
      } catch (error) {
        console.log('❌ Meta API call failed:', error.message);
      }
    }

    // AUDIT 5: Application Logic Check
    console.log('\n🔍 AUDIT 5: APPLICATION LOGIC CHECK');
    console.log('-'.repeat(40));
    
    console.log('🔍 Checking WeeklyReportView component logic...');
    console.log('   - Component expects campaigns with conversion tracking fields');
    console.log('   - If fields are missing or 0, shows "Nie skonfigurowane"');
    console.log('   - Data source: Database campaigns vs Live API data');
    
    // Check what data source the application is using
    console.log('\n🔍 Data Source Analysis:');
    console.log('   - Dashboard: Uses live API data (should show conversion data)');
    console.log('   - Reports Page: Uses live API data (should show conversion data)');
    console.log('   - Admin Panel: Uses database data (may not have conversion data)');
    console.log('   - WeeklyReportView: Depends on data source passed to it');

    // AUDIT 6: Cache and State Check
    console.log('\n🔍 AUDIT 6: CACHE AND STATE CHECK');
    console.log('-'.repeat(40));
    
    console.log('🔍 Potential cache issues:');
    console.log('   - Browser cache may be showing old data');
    console.log('   - Application state may be cached');
    console.log('   - Database cache may be stale');
    console.log('   - API responses may be cached');

    // AUDIT 7: Component Rendering Check
    console.log('\n🔍 AUDIT 7: COMPONENT RENDERING CHECK');
    console.log('-'.repeat(40));
    
    console.log('🔍 WeeklyReportView rendering logic:');
    console.log('   - Checks if conversionTotals.click_to_call === 0');
    console.log('   - Checks if conversionTotals.lead === 0');
    console.log('   - Checks if conversionTotals.booking_step_1 === 0');
    console.log('   - If any are 0, shows "Nie skonfigurowane"');
    console.log('   - If all have data, shows actual values');

    // AUDIT 8: Summary and Recommendations
    console.log('\n🔍 AUDIT 8: SUMMARY AND RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    console.log('🎯 ROOT CAUSE ANALYSIS:');
    
    if (dbCampaigns && dbCampaigns.length === 0) {
      console.log('❌ PRIMARY ISSUE: No campaigns in database');
      console.log('   - The application is trying to read from database');
      console.log('   - Database has no campaign data');
      console.log('   - This causes all conversion metrics to be 0');
      console.log('   - WeeklyReportView shows "Nie skonfigurowane"');
    } else if (dbCampaigns && dbCampaigns.length > 0 && !dbCampaigns[0].hasOwnProperty('click_to_call')) {
      console.log('❌ PRIMARY ISSUE: Missing conversion tracking columns in database');
      console.log('   - Campaigns exist but lack conversion tracking fields');
      console.log('   - This causes conversion metrics to be undefined/null');
      console.log('   - WeeklyReportView treats undefined as 0');
      console.log('   - Shows "Nie skonfigurowane"');
    } else {
      console.log('❌ PRIMARY ISSUE: Data source mismatch');
      console.log('   - Application is using wrong data source');
      console.log('   - Should use live API data instead of database');
      console.log('   - Database data may be stale or incomplete');
    }

    console.log('\n🔧 RECOMMENDED SOLUTIONS:');
    console.log('1. Force application to use live API data');
    console.log('2. Add missing database columns if needed');
    console.log('3. Clear all caches (browser, application, database)');
    console.log('4. Ensure proper data flow from API to UI components');
    console.log('5. Add database migration for conversion tracking columns');

    console.log('\n🎯 IMMEDIATE ACTIONS:');
    console.log('1. Clear browser cache and reload page');
    console.log('2. Check if using correct data source in application');
    console.log('3. Verify Meta API token permissions');
    console.log('4. Test live data fetching directly');
    console.log('5. Check component props and data flow');

  } catch (error) {
    console.error('💥 Comprehensive audit failed:', error);
  }
}

comprehensiveConversionAudit(); 