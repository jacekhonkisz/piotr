import fetch from 'node-fetch';

async function testAISummary() {
  try {
    console.log('🧪 Testing AI Summary endpoint...');
    
    const response = await fetch('http://localhost:3000/api/generate-executive-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        }
      })
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('📊 Response body:', result);
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('✅ AI Summary success:', data.success);
      console.log('📝 Summary length:', data.summary?.length || 0);
      console.log('📝 Summary preview:', data.summary?.substring(0, 200) + '...');
    } else {
      console.log('❌ AI Summary failed');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testAISummary();
