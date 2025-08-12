require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSystemUserToken() {
  console.log('🔐 Getting system user authentication...');
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.session?.access_token) {
      throw new Error('No access token received');
    }

    console.log('✅ Authentication successful');
    return data.session.access_token;
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    throw error;
  }
}

async function getStoredSummaries() {
  console.log('📊 Fetching stored campaign summaries...');
  
  const { data: summaries, error } = await supabase
    .from('campaign_summaries')
    .select(`
      *,
      clients(name, email)
    `)
    .order('summary_date', { ascending: false })
    .limit(50); // Get latest 50 summaries for analysis

  if (error) {
    throw new Error(`Failed to fetch stored data: ${error.message}`);
  }

  console.log(`   📅 Date range of summaries: ${summaries[summaries.length-1]?.summary_date} to ${summaries[0]?.summary_date}`);

  return summaries || [];
}

async function validateStorageDatabase() {
  console.log('🧪 Starting Simple Storage Database Validation');
  console.log('=' .repeat(60));
  
  try {
    // Get authentication token
    const token = await getSystemUserToken();
    
    // Get stored summaries
    const summaries = await getStoredSummaries();
    console.log(`✅ Found ${summaries.length} stored summaries to analyze\n`);
    
    if (summaries.length === 0) {
      console.log('❌ No stored summaries found for validation');
      return;
    }
    
    // Group by client for analysis
    const clientGroups = {};
    summaries.forEach(summary => {
      const clientName = summary.clients?.name || 'Unknown';
      if (!clientGroups[clientName]) {
        clientGroups[clientName] = { monthly: [], weekly: [] };
      }
      clientGroups[clientName][summary.summary_type].push(summary);
    });
    
    console.log('📋 Storage Database Analysis by Client:');
    console.log('='.repeat(50));
    
    let totalAnalyzed = 0;
    let issuesFound = [];
    
    for (const [clientName, data] of Object.entries(clientGroups)) {
      console.log(`\n👤 ${clientName}:`);
      console.log(`   📅 Monthly summaries: ${data.monthly.length}`);
      console.log(`   📅 Weekly summaries: ${data.weekly.length}`);
      
      // Analyze monthly data
      if (data.monthly.length > 0) {
        const latest = data.monthly[0]; // Most recent
        console.log(`\n   📊 Latest Monthly Summary (${latest.summary_date}):`);
        console.log(`      💰 Total Spend: $${latest.total_spend?.toLocaleString() || 0}`);
        console.log(`      👁️ Impressions: ${latest.total_impressions?.toLocaleString() || 0}`);
        console.log(`      🖱️ Clicks: ${latest.total_clicks?.toLocaleString() || 0}`);
        console.log(`      🎯 Conversions: ${latest.total_conversions?.toLocaleString() || 0}`);
        console.log(`      📈 Active Campaigns: ${latest.active_campaigns || 0}`);
        
        totalAnalyzed++;
        
        // Check for obvious issues
        if (latest.total_spend === 0 && latest.total_impressions === 0) {
          issuesFound.push({
            client: clientName,
            period: latest.summary_date,
            type: 'monthly',
            issue: 'All metrics are zero'
          });
        }
        
        if (latest.active_campaigns === 0 && latest.total_spend > 0) {
          issuesFound.push({
            client: clientName,
            period: latest.summary_date,
            type: 'monthly',
            issue: 'Active campaigns is 0 but has spend'
          });
        }
      }
      
      // Analyze weekly data - show latest week
      if (data.weekly.length > 0) {
        const latest = data.weekly[0]; // Most recent
        console.log(`\n   📊 Latest Weekly Summary (${latest.summary_date}):`);
        console.log(`      💰 Total Spend: $${latest.total_spend?.toLocaleString() || 0}`);
        console.log(`      👁️ Impressions: ${latest.total_impressions?.toLocaleString() || 0}`);
        console.log(`      🖱️ Clicks: ${latest.total_clicks?.toLocaleString() || 0}`);
        console.log(`      🎯 Conversions: ${latest.total_conversions?.toLocaleString() || 0}`);
        console.log(`      📈 Active Campaigns: ${latest.active_campaigns || 0}`);
        
        totalAnalyzed++;
        
        // Check for obvious issues
        if (latest.total_spend === 0 && latest.total_impressions === 0) {
          issuesFound.push({
            client: clientName,
            period: latest.summary_date,
            type: 'weekly',
            issue: 'All metrics are zero'
          });
        }
        
        if (latest.active_campaigns === 0 && latest.total_spend > 0) {
          issuesFound.push({
            client: clientName,
            period: latest.summary_date,
            type: 'weekly',
            issue: 'Active campaigns is 0 but has spend'
          });
        }
      }
    }
    
    // Summary Analysis
    console.log('\n' + '='.repeat(60));
    console.log('📊 STORAGE DATABASE ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total periods analyzed: ${totalAnalyzed}`);
    console.log(`Issues found: ${issuesFound.length}`);
    
    if (issuesFound.length > 0) {
      console.log('\n⚠️ POTENTIAL ISSUES DETECTED:');
      issuesFound.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.client} - ${issue.type} ${issue.period}`);
        console.log(`   Issue: ${issue.issue}`);
      });
      
      const issueRate = (issuesFound.length / totalAnalyzed) * 100;
      console.log(`\n📈 Issue rate: ${issueRate.toFixed(1)}%`);
      
      if (issueRate > 50) {
        console.log('❌ HIGH: Storage database has significant issues');
      } else if (issueRate > 20) {
        console.log('⚠️ MEDIUM: Storage database has some issues');
      } else {
        console.log('✅ LOW: Storage database looks mostly healthy');
      }
    } else {
      console.log('\n🎉 No obvious issues detected in storage database!');
      console.log('✅ Storage database appears to be functioning correctly');
    }
    
    // Data freshness check
    console.log('\n📅 DATA FRESHNESS CHECK:');
    const mostRecentDate = Math.max(...summaries.map(s => new Date(s.summary_date).getTime()));
    const mostRecent = new Date(mostRecentDate);
    const daysSinceMostRecent = Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`Most recent summary: ${mostRecent.toISOString().split('T')[0]} (${daysSinceMostRecent} days ago)`);
    
    if (daysSinceMostRecent > 7) {
      console.log('⚠️ Data may be stale - most recent summary is over a week old');
    } else {
      console.log('✅ Data appears fresh');
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    if (issuesFound.length > 0) {
      console.log('• Review and re-run data collection for affected periods');
      console.log('• Verify Meta API connection and credentials');
      console.log('• Check for conversion tracking configuration');
    } else {
      console.log('• Storage database is functioning well');
      console.log('• Continue with regular monitoring');
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run the validation
validateStorageDatabase(); 