/**
 * Manual Backfill Daily Data API
 * 
 * Backfills missing daily_kpi_data for the last 7 days
 * This addresses the 29% completeness issue by filling data gaps
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting manual backfill of daily data...');
    
    // Get date range from request or default to last 7 days
    const body = await request.json().catch(() => ({}));
    const daysToBackfill = body.days || 7;
    
    const dates = [];
    const today = new Date();
    
    // Generate last N days (excluding today)
    for (let i = 1; i <= daysToBackfill; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    console.log(`📅 Backfilling dates: ${dates.join(', ')}`);
    
    const results = [];
    
    for (const targetDate of dates) {
      console.log(`\n📊 Processing date: ${targetDate}`);
      
      try {
        // Call the existing daily collection endpoint for this specific date
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.NEXT_PUBLIC_APP_URL || '') 
          : 'http://localhost:3000';
        const metaResponse = await fetch(`${baseUrl}/api/automated/daily-kpi-collection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: targetDate })
        });
        
        const metaResult = await metaResponse.json();
        
        // Call Google Ads collection if needed
        const googleAdsResponse = await fetch(`${baseUrl}/api/automated/google-ads-daily-collection?date=${targetDate}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const googleAdsResult = await googleAdsResponse.json();
        
        results.push({
          date: targetDate,
          meta: {
            success: metaResult.success,
            processed: metaResult.successCount || 0,
            errors: metaResult.failureCount || 0
          },
          googleAds: {
            success: googleAdsResult.success,
            processed: googleAdsResult.summary?.successful || 0,
            errors: googleAdsResult.summary?.failed || 0
          }
        });
        
        console.log(`✅ Completed ${targetDate}: Meta(${metaResult.successCount || 0}), GoogleAds(${googleAdsResult.summary?.successful || 0})`);
        
      } catch (dateError) {
        console.error(`❌ Error processing ${targetDate}:`, dateError);
        results.push({
          date: targetDate,
          error: dateError instanceof Error ? dateError.message : 'Unknown error'
        });
      }
      
      // Small delay between dates to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Check final data completeness
    const { data: finalData, error: checkError } = await supabaseAdmin!
      .from('daily_kpi_data')
      .select('date, client_id, data_source')
      .gte('date', dates[dates.length - 1])
      .order('date', { ascending: false });
    
    let completenessReport = null;
    if (!checkError && finalData) {
      const uniqueDates = [...new Set(finalData.map(d => d.date))];
      const expectedDays = dates.length;
      const actualDays = uniqueDates.length;
      const completeness = (actualDays / expectedDays) * 100;
      
      completenessReport = {
        expectedDays,
        actualDays,
        completeness: Math.round(completeness),
        dateRange: {
          start: uniqueDates[uniqueDates.length - 1],
          end: uniqueDates[0]
        },
        totalRecords: finalData.length
      };
      
      console.log(`📊 Final completeness: ${Math.round(completeness)}% (${actualDays}/${expectedDays} days)`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Backfilled ${dates.length} days of daily data`,
      daysProcessed: dates.length,
      results,
      completenessReport,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
