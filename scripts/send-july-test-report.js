require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendJulyTestReport() {
  console.log('📧 Sending July Test Report...\n');

  const resend = new Resend(process.env.RESEND_API_KEY);
  
  // July 2024 date range
  const julyStart = '2024-07-01';
  const julyEnd = '2024-07-31';
  
  // Sample report data for July
  const reportData = {
    dateRange: `${julyStart} to ${julyEnd}`,
    totalSpend: 18750.75,
    totalImpressions: 425000,
    totalClicks: 8500,
    ctr: 0.02, // 2%
    cpc: 2.21,
    cpm: 44.12
  };

  const clientName = 'jacek';
  const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  
  // Email addresses to send to
  const emailAddresses = ['jac.honkisz@gmail.com', 'a.honkisz01@gmail.com'];
  
  console.log(`📊 Report Details:`);
  console.log(`   - Period: July 2024 (${julyStart} to ${julyEnd})`);
  console.log(`   - Client: ${clientName}`);
  console.log(`   - Recipients: ${emailAddresses.join(', ')}`);
  console.log(`   - Total Spend: $${reportData.totalSpend.toLocaleString()}`);
  console.log(`   - Impressions: ${reportData.totalImpressions.toLocaleString()}`);
  console.log(`   - Clicks: ${reportData.totalClicks.toLocaleString()}`);
  console.log('');

  // Send to each email address
  for (const email of emailAddresses) {
    try {
      console.log(`📧 Sending to: ${email}`);
      
      const emailTemplate = generateInteractiveReportEmailTemplate(clientName, reportData);
      
      const emailData = {
        to: email,
        from: fromEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text
        // Removed PDF attachment to avoid issues
      };

      const { data, error } = await resend.emails.send(emailData);

      if (error) {
        console.log(`❌ Failed to send to ${email}: ${error.message}`);
      } else {
        console.log(`✅ Sent successfully to ${email}`);
        console.log(`   Message ID: ${data?.id}`);
      }
      
    } catch (error) {
      console.log(`❌ Error sending to ${email}: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎉 July test report sending completed!');
  console.log('📧 Check your email inboxes for the test reports.');
}

function generateInteractiveReportEmailTemplate(clientName, reportData) {
  const subject = `Your Interactive Meta Ads Report - ${reportData.dateRange}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Interactive Meta Ads Report</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .metric { display: flex; justify-content: space-between; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .metric-label { font-weight: bold; color: #495057; }
        .metric-value { font-weight: bold; color: #28a745; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .highlight { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Meta Ads Report</h1>
          <p>July 2024 Performance Summary</p>
        </div>
        
        <div class="content">
          <h2>Hello ${clientName},</h2>
          
          <p>Here's your comprehensive Meta Ads report for <strong>July 2024</strong>. We've analyzed your campaign performance and prepared detailed insights to help you optimize your advertising strategy.</p>
          
          <div class="highlight">
            <h3>🎯 Key Performance Highlights</h3>
            <p>Your campaigns showed strong performance with excellent engagement rates and cost efficiency.</p>
          </div>
          
          <h3>📈 Performance Metrics</h3>
          
          <div class="metric">
            <span class="metric-label">Total Spend:</span>
            <span class="metric-value">$${reportData.totalSpend.toLocaleString()}</span>
          </div>
          
          <div class="metric">
            <span class="metric-label">Total Impressions:</span>
            <span class="metric-value">${reportData.totalImpressions.toLocaleString()}</span>
          </div>
          
          <div class="metric">
            <span class="metric-label">Total Clicks:</span>
            <span class="metric-value">${reportData.totalClicks.toLocaleString()}</span>
          </div>
          
          <div class="metric">
            <span class="metric-label">Click-Through Rate (CTR):</span>
            <span class="metric-value">${(reportData.ctr * 100).toFixed(2)}%</span>
          </div>
          
          <div class="metric">
            <span class="metric-label">Cost Per Click (CPC):</span>
            <span class="metric-value">$${reportData.cpc.toFixed(2)}</span>
          </div>
          
          <div class="metric">
            <span class="metric-label">Cost Per Mille (CPM):</span>
            <span class="metric-value">$${reportData.cpm.toFixed(2)}</span>
          </div>
          
          <h3>📎 Interactive PDF Report</h3>
          <p>Your detailed interactive PDF report includes:</p>
          <ul>
            <li>📊 Detailed campaign breakdowns</li>
            <li>📈 Performance trends and analysis</li>
            <li>🎯 Optimization recommendations</li>
            <li>📱 Audience insights and demographics</li>
            <li>💰 ROI and conversion tracking</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" class="button">📊 View Dashboard</a>
          </div>
          
          <h3>💡 Key Insights</h3>
          <ul>
            <li><strong>Strong Performance:</strong> Your campaigns achieved excellent engagement rates</li>
            <li><strong>Cost Efficiency:</strong> CPC and CPM are within optimal ranges</li>
            <li><strong>Scalability:</strong> Opportunities to expand successful campaigns</li>
            <li><strong>Optimization:</strong> Specific recommendations for improvement</li>
          </ul>
          
          <h3>🚀 Next Steps</h3>
          <p>Based on this month's performance, we recommend:</p>
          <ol>
            <li>Review the detailed PDF report for specific insights</li>
            <li>Implement the optimization recommendations</li>
            <li>Consider scaling successful campaigns</li>
            <li>Schedule a follow-up discussion if needed</li>
          </ol>
        </div>
        
        <div class="footer">
          <p>📧 Questions? Contact us at support@yourdomain.com</p>
          <p>📱 Dashboard: <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">${process.env.NEXT_PUBLIC_APP_URL}/dashboard</a></p>
          <p>© 2024 Premium Analytics. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Meta Ads Report - July 2024
    
    Hello ${clientName},
    
    Here's your comprehensive Meta Ads report for July 2024. We've analyzed your campaign performance and prepared detailed insights to help you optimize your advertising strategy.
    
    KEY PERFORMANCE METRICS:
    - Total Spend: $${reportData.totalSpend.toLocaleString()}
    - Total Impressions: ${reportData.totalImpressions.toLocaleString()}
    - Total Clicks: ${reportData.totalClicks.toLocaleString()}
    - Click-Through Rate (CTR): ${(reportData.ctr * 100).toFixed(2)}%
    - Cost Per Click (CPC): $${reportData.cpc.toFixed(2)}
    - Cost Per Mille (CPM): $${reportData.cpm.toFixed(2)}
    
    INTERACTIVE PDF REPORT:
    Your detailed interactive PDF report includes:
    - Detailed campaign breakdowns
    - Performance trends and analysis
    - Optimization recommendations
    - Audience insights and demographics
    - ROI and conversion tracking
    
    KEY INSIGHTS:
    - Strong Performance: Your campaigns achieved excellent engagement rates
    - Cost Efficiency: CPC and CPM are within optimal ranges
    - Scalability: Opportunities to expand successful campaigns
    - Optimization: Specific recommendations for improvement
    
    NEXT STEPS:
    1. Review the detailed PDF report for specific insights
    2. Implement the optimization recommendations
    3. Consider scaling successful campaigns
    4. Schedule a follow-up discussion if needed
    
    Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard
    Questions? Contact us at support@yourdomain.com
    
    © 2024 Premium Analytics. All rights reserved.
  `;
  
  return { subject, html, text };
}

sendJulyTestReport(); 