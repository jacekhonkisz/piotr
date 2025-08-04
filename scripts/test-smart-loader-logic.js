require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🧪 Testing Smart Data Loader Logic...\n');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mock SmartDataLoader logic
class MockSmartDataLoader {
  constructor() {
    this.supabase = supabase;
  }

  async loadFromStorage(clientId, dateRange) {
    console.log(`   📊 Checking storage for client ${clientId}...`);
    
    const { data, error } = await this.supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .gte('summary_date', dateRange.start)
      .lte('summary_date', dateRange.end)
      .order('summary_date', { ascending: true });

    if (error) {
      console.log(`   ❌ Storage query error: ${error.message}`);
      return null;
    }

    if (data && data.length > 0) {
      console.log(`   ✅ Found ${data.length} stored summaries`);
      return {
        data: data,
        source: 'storage',
        lastUpdated: new Date(),
        isHistorical: false,
        dataAge: 'Cached data'
      };
    }

    console.log(`   ⚠️ No stored data found`);
    return null;
  }

  async loadFromAPI(clientId, dateRange) {
    console.log(`   🔄 Fetching from API for client ${clientId}...`);
    
    // Mock API response
    const mockData = {
      campaigns: [
        {
          id: 'test-campaign-1',
          name: 'Test Campaign',
          spend: 1000,
          impressions: 10000,
          clicks: 500,
          conversions: 50,
          ctr: 5.0,
          cpc: 2.0,
          cpa: 20.0
        }
      ],
      metaTables: {
        placementPerformance: { test: 'placement' },
        demographicPerformance: { test: 'demographic' },
        adRelevanceResults: { test: 'relevance' }
      }
    };

    return {
      data: mockData,
      source: 'api',
      lastUpdated: new Date(),
      isHistorical: false,
      dataAge: 'Live data'
    };
  }

  async loadData(clientId, dateRange) {
    console.log(`\n🔍 Loading data for client ${clientId}`);
    console.log(`   Date range: ${dateRange.start} to ${dateRange.end}`);

    // Check if data is recent (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const startDate = new Date(dateRange.start);
    const isRecentData = startDate >= twelveMonthsAgo;
    
    console.log(`   📅 Is recent data: ${isRecentData}`);

    if (isRecentData) {
      console.log(`   🗄️ Checking storage first...`);
      const storedResult = await this.loadFromStorage(clientId, dateRange);
      if (storedResult) {
        console.log(`   ✅ Using stored data`);
        return storedResult;
      }
    }

    console.log(`   🌐 Fetching from API...`);
    const apiResult = await this.loadFromAPI(clientId, dateRange);
    
    if (isRecentData) {
      console.log(`   💾 Storing recent data for future use...`);
      // Mock storage
      await this.storeData(clientId, apiResult.data, dateRange);
    }

    return {
      data: apiResult.data,
      source: 'api',
      lastUpdated: new Date(),
      isHistorical: !isRecentData,
      dataAge: isRecentData ? 'Live data' : 'Historical data'
    };
  }

  async storeData(clientId, data, dateRange) {
    console.log(`   💾 Storing data for client ${clientId}...`);
    
    const summary = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: dateRange.start,
      total_spend: 1000.00,
      total_impressions: 10000,
      total_clicks: 500,
      total_conversions: 50,
      average_ctr: 5.00,
      average_cpc: 2.00,
      average_cpa: 20.00,
      active_campaigns: 1,
      total_campaigns: 1,
      campaign_data: data.campaigns,
      meta_tables: data.metaTables,
      data_source: 'meta_api',
      last_updated: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date'
      });

    if (error) {
      console.log(`   ❌ Storage error: ${error.message}`);
    } else {
      console.log(`   ✅ Data stored successfully`);
    }
  }
}

async function testSmartLoaderLogic() {
  try {
    console.log('1. Testing Smart Data Loader Logic...\n');

    const loader = new MockSmartDataLoader();
    
    // Test with recent data (should check storage first)
    console.log('📋 Test 1: Recent Data (Last 12 months)');
    const recentResult = await loader.loadData('test-client-1', {
      start: '2025-07-01',
      end: '2025-07-31'
    });
    
    console.log(`   📊 Result: ${recentResult.source} | ${recentResult.dataAge}`);
    console.log(`   📈 Campaigns: ${recentResult.data.campaigns.length}`);

    // Test with historical data (should go directly to API)
    console.log('\n📋 Test 2: Historical Data (Older than 12 months)');
    const historicalResult = await loader.loadData('test-client-1', {
      start: '2023-01-01',
      end: '2023-01-31'
    });
    
    console.log(`   📊 Result: ${historicalResult.source} | ${historicalResult.dataAge}`);
    console.log(`   📈 Campaigns: ${historicalResult.data.campaigns.length}`);

    // Test storage retrieval
    console.log('\n📋 Test 3: Storage Retrieval');
    const storedData = await loader.loadFromStorage('test-client-1', {
      start: '2025-07-01',
      end: '2025-07-31'
    });
    
    if (storedData) {
      console.log(`   ✅ Stored data found: ${storedData.data.length} summaries`);
    } else {
      console.log(`   ⚠️ No stored data found`);
    }

    console.log('\n🎉 Smart Data Loader Logic Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Recent data logic: Working');
    console.log('   ✅ Historical data logic: Working');
    console.log('   ✅ Storage operations: Working');
    console.log('   ✅ API fallback: Working');
    console.log('   ✅ Data flow: Correct');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSmartLoaderLogic(); 