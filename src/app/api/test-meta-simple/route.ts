import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🔍 Testing basic Meta API connectivity...');
  
  try {
    // Test 1: Basic connectivity to Meta API
    console.log('🔍 Test 1: Testing basic connectivity...');
    const startTime = Date.now();
    
    const response = await fetch('https://graph.facebook.com/v18.0/me?access_token=invalid_token');
    const endTime = Date.now();
    
    console.log('📡 Meta API response time:', endTime - startTime, 'ms');
    console.log('📡 Meta API response status:', response.status);
    
    const data = await response.json();
    console.log('📡 Meta API response data:', data);
    
    return NextResponse.json({
      success: true,
      tests: {
        connectivity: '✅ Success',
        responseTime: `${endTime - startTime}ms`,
        status: response.status,
        hasError: !!data.error,
        errorType: data.error?.type || 'none'
      },
      message: 'Meta API is reachable, but token is invalid (as expected)'
    });
    
  } catch (error) {
    console.error('❌ Meta API connectivity test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Cannot reach Meta API',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 