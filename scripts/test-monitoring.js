const fetch = require('node-fetch');

async function testMonitoringEndpoints() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing Monitoring Endpoints...\n');
  
  // Test health endpoint
  try {
    console.log('1. Testing /api/health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthResponse.json();
    
    console.log('✅ Health endpoint response:', {
      status: healthResponse.status,
      data: healthData
    });
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.message);
  }
  
  // Test metrics endpoint
  try {
    console.log('\n2. Testing /api/metrics endpoint...');
    const metricsResponse = await fetch(`${baseUrl}/api/metrics`);
    const metricsData = await metricsResponse.json();
    
    console.log('✅ Metrics endpoint response:', {
      status: metricsResponse.status,
      data: metricsData
    });
  } catch (error) {
    console.log('❌ Metrics endpoint failed:', error.message);
  }
  
  // Test monitoring page
  try {
    console.log('\n3. Testing /admin/monitoring page...');
    const monitoringResponse = await fetch(`${baseUrl}/admin/monitoring`);
    
    console.log('✅ Monitoring page response:', {
      status: monitoringResponse.status,
      contentType: monitoringResponse.headers.get('content-type')
    });
  } catch (error) {
    console.log('❌ Monitoring page failed:', error.message);
  }
  
  console.log('\n🎉 Monitoring tests completed!');
}

// Run the tests
testMonitoringEndpoints().catch(console.error); 