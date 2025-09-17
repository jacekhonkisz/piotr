#!/usr/bin/env node

/**
 * Production Health Check Script
 * 
 * Monitors system health and alerts on issues
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function healthCheck() {
  console.log('🏥 PRODUCTION HEALTH CHECK');
  console.log(`📅 ${new Date().toISOString()}`);
  
  const issues = [];
  
  try {
    // Check database connectivity
    const { data: testQuery } = await supabase
      .from('clients')
      .select('id')
      .limit(1);
    
    if (!testQuery) {
      issues.push('Database connectivity failed');
    } else {
      console.log('✅ Database connectivity: OK');
    }
    
    // Check data coverage
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name');
    
    let clientsWithIssues = 0;
    
    for (const client of clients) {
      const { count: monthlyCount } = await supabase
        .from('campaign_summaries')
        .select('id', { count: 'exact' })
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly')
        .eq('platform', 'meta');
      
      const { count: weeklyCount } = await supabase
        .from('campaign_summaries')
        .select('id', { count: 'exact' })
        .eq('client_id', client.id)
        .eq('summary_type', 'weekly')
        .eq('platform', 'meta');
      
      if ((monthlyCount || 0) < 10 || (weeklyCount || 0) < 40) {
        clientsWithIssues++;
      }
    }
    
    if (clientsWithIssues > 0) {
      issues.push(`${clientsWithIssues} clients have insufficient historical data`);
    } else {
      console.log('✅ Data coverage: OK');
    }
    
    // Check for fake Google data
    const { count: fakeGoogleCount } = await supabase
      .from('campaign_summaries')
      .select('id', { count: 'exact' })
      .eq('platform', 'google')
      .like('data_source', '%converted%');
    
    if ((fakeGoogleCount || 0) > 0) {
      issues.push(`${fakeGoogleCount} fake Google Ads records found`);
    } else {
      console.log('✅ Platform separation: OK');
    }
    
    // Summary
    if (issues.length === 0) {
      console.log('\n🎉 SYSTEM HEALTH: ALL OK');
    } else {
      console.log(`\n⚠️ SYSTEM HEALTH: ${issues.length} ISSUES FOUND`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    issues.push(`Health check error: ${error.message}`);
  }
  
  return issues;
}

// Run health check
if (require.main === module) {
  healthCheck()
    .then((issues) => {
      process.exit(issues.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    });
}

module.exports = { healthCheck };