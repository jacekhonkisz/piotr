// Script to populate historical weekly data for testing

const fetch = require('node-fetch');

async function populateHistoricalData() {
  console.log('🚀 Starting historical data population...');
  
  try {
    // First, get a session token (you'll need to replace this with actual token)
    console.log('⚠️  You need to:');
    console.log('1. Open browser developer tools');
    console.log('2. Go to Application > Local Storage');
    console.log('3. Find the auth token');
    console.log('4. Replace TOKEN_HERE in this script');
    
    const TOKEN = 'TOKEN_HERE'; // Replace with actual token from browser
    
    if (TOKEN === 'TOKEN_HERE') {
      console.log('❌ Please set a real token first!');
      return;
    }
    
    // Trigger monthly data collection
    console.log('📅 Triggering monthly data collection...');
    const monthlyResponse = await fetch('http://localhost:3000/api/background/collect-monthly', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (monthlyResponse.ok) {
      const monthlyResult = await monthlyResponse.json();
      console.log('✅ Monthly collection started:', monthlyResult);
    } else {
      console.log('❌ Monthly collection failed:', await monthlyResponse.text());
    }
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Trigger weekly data collection
    console.log('📅 Triggering weekly data collection...');
    const weeklyResponse = await fetch('http://localhost:3000/api/background/collect-weekly', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (weeklyResponse.ok) {
      const weeklyResult = await weeklyResponse.json();
      console.log('✅ Weekly collection started:', weeklyResult);
    } else {
      console.log('❌ Weekly collection failed:', await weeklyResponse.text());
    }
    
    console.log('🎉 Background data collection triggered!');
    console.log('⏳ Wait 2-5 minutes for data to be collected...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

populateHistoricalData(); 