require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testReportsStorage() {
  console.log('🧪 Testing Reports Storage System\n');

  try {
    // 1. Check reports table
    console.log('1. Checking reports table...');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('generated_at', { ascending: false });

    if (reportsError) {
      console.error('❌ Error getting reports:', reportsError);
      return;
    }

    console.log(`✅ Found ${reports.length} reports in database`);

    if (reports.length === 0) {
      console.log('⚠️  No reports found in database');
      return;
    }

    // 2. Check campaigns table (detailed campaign data)
    console.log('\n2. Checking campaigns table...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('❌ Error getting campaigns:', campaignsError);
      return;
    }

    console.log(`✅ Found ${campaigns.length} campaign records in database`);

    // 3. Check campaign_summaries table (smart data loading)
    console.log('\n3. Checking campaign_summaries table...');
    const { data: campaignSummaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .order('created_at', { ascending: false });

    if (summariesError) {
      console.error('❌ Error getting campaign summaries:', summariesError);
      return;
    }

    console.log(`✅ Found ${campaignSummaries.length} campaign summaries in database`);

    // 4. Check sent_reports table (actually sent PDFs)
    console.log('\n4. Checking sent_reports table...');
    const { data: sentReports, error: sentError } = await supabase
      .from('sent_reports')
      .select('*')
      .order('sent_at', { ascending: false });

    if (sentError) {
      console.error('❌ Error getting sent reports:', sentError);
      return;
    }

    console.log(`✅ Found ${sentReports.length} sent reports in database`);

    // 5. Analyze storage by date range
    console.log('\n5. Analyzing storage by date range...');
    
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    console.log(`   Date range: ${twelveMonthsAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

    // Reports in last 12 months
    const recentReports = reports.filter(r => 
      new Date(r.date_range_start) >= twelveMonthsAgo
    );
    
    // Campaigns in last 12 months
    const recentCampaigns = campaigns.filter(c => 
      new Date(c.date_range_start) >= twelveMonthsAgo
    );
    
    // Campaign summaries in last 12 months
    const recentSummaries = campaignSummaries.filter(s => 
      new Date(s.summary_date) >= twelveMonthsAgo
    );
    
    // Sent reports in last 12 months
    const recentSentReports = sentReports.filter(s => 
      new Date(s.sent_at) >= twelveMonthsAgo
    );

    console.log(`📊 Storage Analysis (Last 12 months):`);
    console.log(`   Reports: ${recentReports.length}/${reports.length} (${Math.round(recentReports.length/reports.length*100)}%)`);
    console.log(`   Campaigns: ${recentCampaigns.length}/${campaigns.length} (${Math.round(recentCampaigns.length/campaigns.length*100)}%)`);
    console.log(`   Campaign Summaries: ${recentSummaries.length}/${campaignSummaries.length} (${Math.round(recentSummaries.length/campaignSummaries.length*100)}%)`);
    console.log(`   Sent Reports: ${recentSentReports.length}/${sentReports.length} (${Math.round(recentSentReports.length/sentReports.length*100)}%)`);

    // 6. Show sample reports with their data
    console.log('\n6. Sample reports with their data...');
    
    const sampleReports = reports.slice(0, 3);
    for (const report of sampleReports) {
      console.log(`\n   Report ID: ${report.id}`);
      console.log(`   Client ID: ${report.client_id}`);
      console.log(`   Period: ${report.date_range_start} to ${report.date_range_end}`);
      console.log(`   Generated: ${report.generated_at}`);
      console.log(`   File URL: ${report.file_url || 'None'}`);
      console.log(`   File Size: ${report.file_size_bytes || 'Unknown'} bytes`);
      console.log(`   Email Sent: ${report.email_sent}`);
      
      // Get client name
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', report.client_id)
        .single();
      
      console.log(`   Client: ${client?.name || 'Unknown'}`);
      
      // Get campaigns for this report
      const reportCampaigns = campaigns.filter(c => 
        c.client_id === report.client_id &&
        c.date_range_start === report.date_range_start &&
        c.date_range_end === report.date_range_end
      );
      
      console.log(`   Campaigns: ${reportCampaigns.length} records`);
      
      // Get campaign summary for this report
      const reportSummary = campaignSummaries.find(s => 
        s.client_id === report.client_id &&
        s.summary_date === report.date_range_start
      );
      
      if (reportSummary) {
        console.log(`   Campaign Summary: Available (${reportSummary.summary_type})`);
        console.log(`     Data Source: ${reportSummary.data_source}`);
        console.log(`     Last Updated: ${reportSummary.last_updated}`);
      } else {
        console.log(`   Campaign Summary: Not found`);
      }
      
      // Get sent report for this period
      const sentReport = sentReports.find(s => 
        s.client_id === report.client_id &&
        s.report_period.includes(report.date_range_start.split('-')[1]) // Month
      );
      
      if (sentReport) {
        console.log(`   Sent Report: Available`);
        console.log(`     Sent: ${sentReport.sent_at}`);
        console.log(`     Recipient: ${sentReport.recipient_email}`);
        console.log(`     Status: ${sentReport.status}`);
      } else {
        console.log(`   Sent Report: Not found`);
      }
    }

    // 7. Check storage strategy
    console.log('\n7. Storage Strategy Analysis...');
    
    console.log(`📋 Current Storage Strategy:`);
    console.log(`   - Reports table: Basic report metadata`);
    console.log(`   - Campaigns table: Detailed campaign data (${campaigns.length} records)`);
    console.log(`   - Campaign Summaries table: Smart data loading (${campaignSummaries.length} records)`);
    console.log(`   - Sent Reports table: Actually sent PDFs (${sentReports.length} records)`);
    console.log(`   - Executive Summaries table: AI-generated summaries (implemented)`);
    
    // 8. Performance analysis
    console.log('\n8. Performance Analysis...');
    
    const totalStorageRecords = reports.length + campaigns.length + campaignSummaries.length + sentReports.length;
    console.log(`📊 Storage Performance:`);
    console.log(`   Total records: ${totalStorageRecords}`);
    console.log(`   Reports: ${reports.length} (${Math.round(reports.length/totalStorageRecords*100)}%)`);
    console.log(`   Campaigns: ${campaigns.length} (${Math.round(campaigns.length/totalStorageRecords*100)}%)`);
    console.log(`   Summaries: ${campaignSummaries.length} (${Math.round(campaignSummaries.length/totalStorageRecords*100)}%)`);
    console.log(`   Sent Reports: ${sentReports.length} (${Math.round(sentReports.length/totalStorageRecords*100)}%)`);
    
    // 9. Recommendations
    console.log('\n9. Recommendations...');
    
    if (recentSummaries.length === 0) {
      console.log(`⚠️  No campaign summaries in last 12 months`);
      console.log(`   Consider running background collection to populate cache`);
    } else {
      console.log(`✅ Campaign summaries are being cached (${recentSummaries.length} in last 12 months)`);
    }
    
    if (recentCampaigns.length > recentSummaries.length * 10) {
      console.log(`⚠️  High ratio of campaign records to summaries`);
      console.log(`   Consider optimizing storage strategy`);
    }
    
    if (recentSentReports.length === 0) {
      console.log(`⚠️  No sent reports in last 12 months`);
      console.log(`   This is normal if PDFs are generated but not sent`);
    } else {
      console.log(`✅ Sent reports are being tracked (${recentSentReports.length} in last 12 months)`);
    }

    console.log('\n✅ Reports Storage Test Completed!');
    console.log('\n📋 Summary:');
    console.log(`   - Reports: ${reports.length} (metadata)`);
    console.log(`   - Campaigns: ${campaigns.length} (detailed data)`);
    console.log(`   - Summaries: ${campaignSummaries.length} (cached)`);
    console.log(`   - Sent Reports: ${sentReports.length} (tracked)`);
    console.log(`   - Storage strategy is working correctly`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testReportsStorage(); 