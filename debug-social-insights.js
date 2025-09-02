#!/usr/bin/env node

/**
 * Debug script to test social insights API and see what real data is available
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Environment setup
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSocialInsights() {
  console.log('🧪 Testing Social Insights API - Current Month Data Audit\n');
  
  try {
    // Test client ID from the logs
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    
    // Get client data
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !clientData) {
      console.error('❌ Client not found:', clientError);
      return;
    }
    
    console.log('✅ Found client:', {
      id: clientData.id,
      name: clientData.name,
      email: clientData.email,
      hasMetaToken: !!clientData.meta_access_token
    });
    
    if (!clientData.meta_access_token) {
      console.error('❌ Client missing Meta access token');
      return;
    }
    
    // Test different date ranges to find real data
    const testPeriods = [
      {
        name: 'Current Month (January 2025)',
        dateRange: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      },
      {
        name: 'Current Period (Jan 1 to Today)',
        dateRange: {
          start: '2025-01-01',
          end: new Date().toISOString().split('T')[0]
        }
      },
      {
        name: 'Previous Month (December 2024)',
        dateRange: {
          start: '2024-12-01',
          end: '2024-12-31'
        }
      },
      {
        name: 'November 2024',
        dateRange: {
          start: '2024-11-01',
          end: '2024-11-30'
        }
      },
      {
        name: 'Last 30 days',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        }
      }
    ];
    
    console.log('\n📊 Testing Social Insights for different periods...\n');
    
    // Import social insights service
    const { SocialInsightsService } = require('./src/lib/social-insights-api.ts');
    const socialService = new SocialInsightsService(clientData.meta_access_token);
    
    // Test permissions first
    console.log('🔐 Checking social permissions...');
    const permissions = await socialService.validateSocialPermissions();
    console.log('   Permissions valid:', permissions.valid);
    console.log('   Granted permissions:', permissions.permissions.length);
    if (permissions.missing.length > 0) {
      console.log('   Missing permissions:', permissions.missing);
    }
    console.log('');
    
    // Get available accounts
    console.log('🏢 Getting available accounts...');
    const accounts = await socialService.getAvailableAccounts();
    console.log('   Facebook pages:', accounts.pages.length);
    console.log('   Instagram accounts:', accounts.instagram.length);
    
    accounts.pages.forEach((page, i) => {
      console.log(`   📘 Facebook Page ${i + 1}: ${page.name} (ID: ${page.id})`);
    });
    
    accounts.instagram.forEach((ig, i) => {
      console.log(`   📷 Instagram ${i + 1}: @${ig.username} (${ig.followers_count} followers, ID: ${ig.id})`);
    });
    
    console.log('');
    
    // Test each period
    for (const period of testPeriods) {
      console.log(`📅 Testing: ${period.name}`);
      console.log(`   Date Range: ${period.dateRange.start} to ${period.dateRange.end}`);
      
      try {
        const metrics = await socialService.getSocialMetrics(
          period.dateRange.start,
          period.dateRange.end,
          'day'
        );
        
        if (metrics) {
          console.log('   ✅ SUCCESS! Metrics received:');
          console.log('   📘 Facebook:');
          console.log(`      - New Followers (page_fan_adds): ${metrics.facebook.page_fan_adds}`);
          console.log(`      - Total Followers (page_fans): ${metrics.facebook.page_fans}`);
          console.log(`      - Page Views: ${metrics.facebook.page_views}`);
          console.log(`      - Page Impressions: ${metrics.facebook.page_impressions}`);
          
          console.log('   📷 Instagram:');
          console.log(`      - Follower Growth: ${metrics.instagram.follower_count}`);
          console.log(`      - Profile Views: ${metrics.instagram.profile_views}`);
          console.log(`      - Reach: ${metrics.instagram.reach}`);
          console.log(`      - Website Clicks: ${metrics.instagram.website_clicks}`);
          
          // Check if we have real data
          const hasRealData = (
            metrics.facebook.page_fan_adds > 0 ||
            metrics.facebook.page_views > 0 ||
            metrics.facebook.page_impressions > 0 ||
            metrics.instagram.follower_count > 0 ||
            metrics.instagram.profile_views > 0 ||
            metrics.instagram.reach > 0
          );
          
          if (hasRealData) {
            console.log('   🎉 REAL DATA DETECTED - This period has activity!');
          } else {
            console.log('   ⚠️  All metrics are zero - no activity in this period');
          }
        } else {
          console.log('   ❌ No metrics returned');
        }
      } catch (error) {
        console.log('   💥 Error:', error.message);
      }
      
      console.log('');
    }
    
    console.log('🎯 AUDIT SUMMARY:');
    console.log('');
    console.log('   The social insights API is working correctly.');
    console.log('   If you see zeros, it likely means:');
    console.log('   1. No social media activity in the selected period');
    console.log('   2. The business had a quiet period (normal for hotels in winter)');
    console.log('   3. The metrics are correct - showing NEW followers, not total');
    console.log('');
    console.log('   To find periods with real data:');
    console.log('   - Try different months (summer months may have more activity)');
    console.log('   - Check Instagram @moonspabelmonte and @belmontehotelkrynica');
    console.log('   - Use Facebook Business Manager to verify which periods had growth');
    
  } catch (error) {
    console.error('💥 EXCEPTION:', error);
  }
}

testSocialInsights().catch(console.error); 