const fetch = require('node-fetch');

async function testMetaRankings() {
  console.log('🔍 Testing Meta API Quality Rankings...\n');
  
  // Get the token from the debug output
  const token = 'EAAUeX5mK8YoBPJSCt2Z...'; // This is truncated, need the full token
  
  const timeRange = JSON.stringify({since: '2025-07-01', until: '2025-08-01'});
  const url = `https://graph.facebook.com/v18.0/act_703853679965014/insights?access_token=${token}&fields=ad_name,spend,impressions,clicks,cpp,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(timeRange)}&level=ad&limit=10`;
  
  console.log('🔗 Testing URL:', url.replace(token, 'HIDDEN_TOKEN'));
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(data, null, 2));
    
    if (data.data && data.data.length > 0) {
      console.log('\n📊 Sample ad data:');
      const sampleAd = data.data[0];
      console.log('  - Ad name:', sampleAd.ad_name);
      console.log('  - Quality ranking:', sampleAd.quality_ranking);
      console.log('  - Engagement ranking:', sampleAd.engagement_rate_ranking);
      console.log('  - Conversion ranking:', sampleAd.conversion_rate_ranking);
      console.log('  - Raw data keys:', Object.keys(sampleAd));
    } else {
      console.log('⚠️ No data returned from Meta API');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMetaRankings(); 