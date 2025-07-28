const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sample campaign data for different months
const sampleCampaigns = [
  {
    campaign_id: 'camp_001',
    campaign_name: 'Summer Sale Campaign',
    impressions: 15000,
    clicks: 450,
    spend: 1250.50,
    conversions: 25,
    ctr: 3.0,
    cpc: 2.78,
    cpp: 0.083,
    frequency: 2.1,
    reach: 7142,
    status: 'ACTIVE'
  },
  {
    campaign_id: 'camp_002',
    campaign_name: 'Brand Awareness Q3',
    impressions: 22000,
    clicks: 330,
    spend: 1800.00,
    conversions: 18,
    ctr: 1.5,
    cpc: 5.45,
    cpp: 0.082,
    frequency: 1.8,
    reach: 12222,
    status: 'ACTIVE'
  },
  {
    campaign_id: 'camp_003',
    campaign_name: 'Holiday Special',
    impressions: 18000,
    clicks: 720,
    spend: 2100.75,
    conversions: 45,
    ctr: 4.0,
    cpc: 2.92,
    cpp: 0.117,
    frequency: 2.5,
    reach: 7200,
    status: 'ACTIVE'
  },
  {
    campaign_id: 'camp_004',
    campaign_name: 'Product Launch',
    impressions: 12000,
    clicks: 600,
    spend: 1500.25,
    conversions: 30,
    ctr: 5.0,
    cpc: 2.50,
    cpp: 0.125,
    frequency: 1.5,
    reach: 8000,
    status: 'ACTIVE'
  },
  {
    campaign_id: 'camp_005',
    campaign_name: 'Retargeting Campaign',
    impressions: 8000,
    clicks: 400,
    spend: 800.00,
    conversions: 20,
    ctr: 5.0,
    cpc: 2.00,
    cpp: 0.100,
    frequency: 1.2,
    reach: 6667,
    status: 'ACTIVE'
  }
];

async function generateSampleReports() {
  console.log('🚀 Generating sample reports...\n');

  try {
    // Get client data for jacek
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log(`📋 Generating reports for client: ${client.name} (${client.email})\n`);

    // Generate reports for the last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        startDate: new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
      });
    }

    for (const monthData of months) {
      console.log(`📅 Generating report for ${new Date(monthData.year, monthData.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}...`);

      // Create report record
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: client.id,
          date_range_start: monthData.startDate,
          date_range_end: monthData.endDate,
          generated_at: new Date().toISOString(),
          generation_time_ms: Math.floor(Math.random() * 5000) + 1000, // Random generation time
          email_sent: false
        })
        .select()
        .single();

      if (reportError) {
        console.error(`❌ Error creating report for ${monthData.startDate}:`, reportError);
        continue;
      }

      // Generate 2-4 campaigns per month with varied performance
      const numCampaigns = Math.floor(Math.random() * 3) + 2;
      const monthCampaigns = [];

      for (let i = 0; i < numCampaigns; i++) {
        const baseCampaign = sampleCampaigns[i % sampleCampaigns.length];
        const performanceMultiplier = 0.7 + (Math.random() * 0.6); // 70% to 130% of base performance
        
        const campaign = {
          client_id: client.id,
          campaign_id: `${baseCampaign.campaign_id}_${monthData.year}_${monthData.month.toString().padStart(2, '0')}_${i}`,
          campaign_name: `${baseCampaign.campaign_name} ${monthData.month + 1}/${monthData.year}`,
          date_range_start: monthData.startDate,
          date_range_end: monthData.endDate,
          impressions: Math.floor(baseCampaign.impressions * performanceMultiplier),
          clicks: Math.floor(baseCampaign.clicks * performanceMultiplier),
          spend: Math.round(baseCampaign.spend * performanceMultiplier * 100) / 100,
          conversions: Math.floor(baseCampaign.conversions * performanceMultiplier),
          ctr: baseCampaign.ctr * (0.8 + Math.random() * 0.4), // Vary CTR by ±20%
          cpc: baseCampaign.cpc * (0.8 + Math.random() * 0.4), // Vary CPC by ±20%
          cpp: baseCampaign.cpp * (0.8 + Math.random() * 0.4), // Vary CPP by ±20%
          frequency: baseCampaign.frequency * (0.8 + Math.random() * 0.4), // Vary frequency by ±20%
          reach: Math.floor(baseCampaign.reach * performanceMultiplier),
          status: baseCampaign.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        monthCampaigns.push(campaign);
      }

      // Insert campaigns for this month
      const { error: campaignError } = await supabase
        .from('campaigns')
        .insert(monthCampaigns);

      if (campaignError) {
        console.error(`❌ Error creating campaigns for ${monthData.startDate}:`, campaignError);
      } else {
        console.log(`✅ Created ${monthCampaigns.length} campaigns for ${monthData.startDate}`);
      }
    }

    // Update client's last report date
    await supabase
      .from('clients')
      .update({ last_report_date: new Date().toISOString() })
      .eq('id', client.id);

    console.log('\n🎉 Sample reports generated successfully!');
    console.log('📊 You can now view the beautiful monthly reports interface.');
    console.log('🌐 Open your browser and navigate to the reports page to see the results.');

  } catch (error) {
    console.error('❌ Error generating sample reports:', error);
  }
}

generateSampleReports(); 