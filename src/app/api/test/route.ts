import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Simple test endpoint working' 
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔓 Test API: Authentication disabled');
    const body = await request.json();
    
    if (body.action === 'test-standardized-fetcher') {
      // Test StandardizedDataFetcher
      const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
      
      const result = await StandardizedDataFetcher.fetchData({
        clientId: body.clientId,
        dateRange: body.dateRange,
        platform: body.platform || 'meta',
        reason: 'data-audit-test',
        sessionToken: 'mock-session-token' // Mock token for testing
      });
      
      return NextResponse.json(result);
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
