import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 3 hour cache duration
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000;

interface SocialCacheData {
  facebookNewFollowers: number;
  instagramFollowers: number;
  instagramReach: number;
  instagramProfileViews: number;
  lastUpdated: string;
  fromCache: boolean;
  cacheAge: number;
}

/**
 * GET /api/social-media-cache
 * Returns cached social media data for a client
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    const forceRefresh = request.nextUrl.searchParams.get('forceRefresh') === 'true';
    
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    // Try to get cached data first (unless force refresh)
    if (!forceRefresh) {
      try {
        // Check if table exists (for compatibility)
        const { data: tableCheck } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', 'social_media_cache')
          .single();

        if (tableCheck) {
          const periodId = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          
          const { data: cachedData, error: cacheError } = await supabase
            .from('social_media_cache')
            .select('*')
            .eq('client_id', clientId)
            .eq('period_id', periodId)
            .single();

          if (!cacheError && cachedData) {
            const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
            
            if (cacheAge < CACHE_DURATION_MS) {
              // Fresh cache hit
              return NextResponse.json({
                success: true,
                data: {
                  ...cachedData.cache_data,
                  fromCache: true,
                  cacheAge,
                  source: 'cache'
                }
              });
            }
          }
        }
      } catch (tableError) {
        console.log('Social media cache table not available, proceeding without cache');
      }
    }

    // No cache or force refresh - return empty data for now
    // This will be populated by the background job
    const emptyData: SocialCacheData = {
      facebookNewFollowers: 0,
      instagramFollowers: 0,
      instagramReach: 0,
      instagramProfileViews: 0,
      lastUpdated: new Date().toISOString(),
      fromCache: false,
      cacheAge: 0
    };

    return NextResponse.json({
      success: true,
      data: emptyData,
      source: 'empty',
      message: 'Cache table not ready - social media data will be available after background job runs'
    });

  } catch (error) {
    console.error('Social media cache error:', error);
    return NextResponse.json({
      error: 'Failed to fetch social media cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/social-media-cache
 * Updates cached social media data for a client
 */
export async function POST(request: NextRequest) {
  try {
    const { clientId, data } = await request.json();
    
    if (!clientId || !data) {
      return NextResponse.json({ error: 'Client ID and data required' }, { status: 400 });
    }

    // Try to store in cache if table exists
    try {
      const periodId = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('social_media_cache')
        .upsert({
          client_id: clientId,
          period_id: periodId,
          cache_data: data,
          last_updated: new Date().toISOString()
        });

      if (error) {
        console.error('Error storing social cache:', error);
        return NextResponse.json({ error: 'Failed to store cache' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Social media data cached successfully' 
      });
      
    } catch (tableError) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cache table not available' 
      }, { status: 503 });
    }

  } catch (error) {
    console.error('Social media cache POST error:', error);
    return NextResponse.json({
      error: 'Failed to update social media cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 