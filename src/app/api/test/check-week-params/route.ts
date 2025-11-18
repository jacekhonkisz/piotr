import { NextRequest, NextResponse } from 'next/server';

/**
 * 🧪 TEST ENDPOINT: Check if week range parameters are working
 * Returns what weeks WOULD be processed without actually processing them
 */
async function handleRequest(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testClient = searchParams.get('testClient');
    const startWeek = parseInt(searchParams.get('startWeek') || '0');
    const endWeek = parseInt(searchParams.get('endWeek') || '53');
    
    const weekCount = endWeek - startWeek + 1;
    
    // Simulate what weeks would be collected
    const weeks = [];
    for (let i = startWeek; i <= endWeek; i++) {
      weeks.push(`Week ${i}`);
    }
    
    return NextResponse.json({
      success: true,
      testClient: testClient || 'all clients',
      startWeek,
      endWeek,
      weekCount,
      weeks: weeks.slice(0, 10), // Show first 10
      message: `Would collect ${weekCount} week(s) for ${testClient || 'all clients'}`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

