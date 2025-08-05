/**
 * Simple Performance Test for "Cały Okres" Optimization
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOptimization() {
  console.log('🚀 Testing "Cały Okres" Optimization\n');

  try {
    // Get client data
    console.log('📋 Getting client data...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'client@techcorp.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', client.name);

    // Calculate date range
    const currentDate = new Date();
    const maxPastDate = new Date();
    maxPastDate.setMonth(maxPastDate.getMonth() - 37);
    
    const clientStartDate = new Date(client.created_at);
    const effectiveStartDate = clientStartDate > maxPastDate ? clientStartDate : maxPastDate;

    const startDate = effectiveStartDate.toISOString().split('T')[0];
    const endDate = currentDate.toISOString().split('T')[0];

    console.log('📅 Date range:', { startDate, endDate });

    // Test OPTIMIZED approach
    console.log('\n🚀 Testing OPTIMIZED approach (single API call)...');
    const optimizedStartTime = Date.now();
    
    try {
      const optimizedResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          dateRange: { start: startDate, end: endDate },
          clientId: client.id
        })
      });

      const optimizedEndTime = Date.now();
      const optimizedDuration = optimizedEndTime - optimizedStartTime;

      if (optimizedResponse.ok) {
        const optimizedData = await optimizedResponse.json();
        const campaigns = optimizedData.data?.campaigns || optimizedData.campaigns || [];
        
        console.log('✅ OPTIMIZED approach results:', {
          duration: `${optimizedDuration}ms`,
          status: optimizedResponse.status,
          campaignsFound: campaigns.length,
          totalSpend: campaigns.reduce((sum, c) => sum + parseFloat(c.spend || '0'), 0).toFixed(2)
        });
      } else {
        console.log('❌ OPTIMIZED approach failed:', {
          status: optimizedResponse.status,
          duration: `${optimizedDuration}ms`
        });
      }
    } catch (error) {
      console.log('❌ OPTIMIZED approach error:', error.message);
    }

    // Test OLD approach (limited to 2 months)
    console.log('\n🐌 Testing OLD approach (month-by-month) - limited test...');
    const oldStartTime = Date.now();
    
    const testMonths = 2;
    let successfulMonths = 0;
    
    for (let i = 0; i < testMonths; i++) {
      const testDate = new Date(effectiveStartDate.getFullYear(), effectiveStartDate.getMonth() + i, 1);
      const monthStart = testDate.toISOString().split('T')[0];
      const monthEnd = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
      console.log(`📅 Testing month ${i + 1}/${testMonths}: ${monthStart} to ${monthEnd}`);
      
      try {
        const monthResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            dateRange: { start: monthStart, end: monthEnd },
            clientId: client.id
          })
        });

        if (monthResponse.ok) {
          successfulMonths++;
          console.log(`✅ Month ${i + 1} successful`);
        } else {
          console.log(`❌ Month ${i + 1} failed: ${monthResponse.status}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Month ${i + 1} error:`, error.message);
      }
    }

    const oldEndTime = Date.now();
    const oldDuration = oldEndTime - oldStartTime;

    console.log('📊 OLD approach results (2 months):', {
      duration: `${oldDuration}ms`,
      successfulMonths,
      totalMonths: testMonths
    });

    // Performance comparison
    console.log('\n📊 Performance Comparison');
    console.log('=' .repeat(40));
    
    // Check if we have valid duration data
    if (typeof optimizedDuration !== 'undefined' && optimizedDuration > 0) {
      const estimatedFullDuration = (oldDuration / testMonths) * 18; // Estimate for 18 months
      const speedImprovement = estimatedFullDuration / optimizedDuration;
      

    } else {
      console.log('⚠️ Could not calculate performance improvement due to API errors');
      console.log('📊 Raw timing data:');
      console.log(`🔄 OPTIMIZED: ${optimizedDuration || 'N/A'}ms`);
      console.log(`🐌 OLD (2 months): ${oldDuration}ms`);
    }
    
    console.log('Performance Metrics:');
    console.log(`🔄 OPTIMIZED: ${optimizedDuration}ms`);
    console.log(`🐌 OLD (2 months): ${oldDuration}ms`);
    console.log(`📈 Estimated OLD (18 months): ${estimatedFullDuration.toFixed(0)}ms`);
    console.log(`🚀 Speed Improvement: ${speedImprovement.toFixed(1)}x faster`);
    console.log(`⏱️ Time Saved: ${((estimatedFullDuration - optimizedDuration) / 1000).toFixed(1)} seconds`);
    
    if (speedImprovement > 5) {
      console.log('✅ SIGNIFICANT PERFORMANCE IMPROVEMENT!');
    } else if (speedImprovement > 2) {
      console.log('✅ Good performance improvement');
    } else {
      console.log('⚠️ Minimal performance improvement');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOptimization().catch(console.error); 