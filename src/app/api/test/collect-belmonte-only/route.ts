/**
 * TEST ENDPOINT: Collect weekly data for Belmonte ONLY
 * 
 * Used to diagnose if timeout is due to:
 * - Single client taking too long (data fetching issue)
 * - Multiple clients being processed (time processing issue)
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 TEST: Starting Belmonte-only collection...');

    // Get Belmonte client ONLY
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .limit(1);

    if (clientsError) {
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Belmonte client not found'
      }, { status: 404 });
    }

    const belmonte = clients[0];
    console.log('✅ Found Belmonte:', belmonte.name);

    // Use the private method through type casting
    const collector = BackgroundDataCollector.getInstance();
    
    console.log('🔄 Starting collection for Belmonte only...');
    const collectionStart = Date.now();
    
    // @ts-ignore - accessing private method for testing
    await collector.collectWeeklySummaryForClient(belmonte);
    
    const collectionDuration = Date.now() - collectionStart;
    const totalDuration = Date.now() - startTime;

    console.log(`✅ Belmonte collection completed in ${collectionDuration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Belmonte weekly data collection completed',
      client: belmonte.name,
      timings: {
        collectionMs: collectionDuration,
        collectionSeconds: (collectionDuration / 1000).toFixed(2),
        totalMs: totalDuration,
        totalSeconds: (totalDuration / 1000).toFixed(2)
      },
      analysis: {
        underTimeout: collectionDuration < 180000,
        timeoutMargin: `${((180000 - collectionDuration) / 1000).toFixed(2)}s remaining`,
        estimatedFor2Clients: `${((collectionDuration * 2) / 1000).toFixed(2)}s`,
        wouldTimeoutWith2Clients: (collectionDuration * 2) > 180000
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    
    console.error('❌ Belmonte collection failed:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      durationMs: totalDuration,
      durationSeconds: (totalDuration / 1000).toFixed(2),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Support GET for easy browser testing
  return POST(request);
}

