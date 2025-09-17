#!/usr/bin/env node

/**
 * AUDIT #3: Timeline & Progress Tracking
 * Client-Ready Report - Track setup progress and provide timeline updates
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class TimelineProgressAudit {
  constructor() {
    this.milestones = [
      {
        id: 'credentials_configured',
        name: 'API Credentials Configuration',
        description: 'Developer token, OAuth credentials, and manager account setup',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '30 minutes'
      },
      {
        id: 'oauth_working',
        name: 'OAuth Authentication Flow',
        description: 'Successful token refresh and authentication',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '15 minutes'
      },
      {
        id: 'api_enabled',
        name: 'Google Ads API Enabled',
        description: 'API enabled in Google Cloud Console',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '5 minutes'
      },
      {
        id: 'token_submitted',
        name: 'Developer Token Submitted',
        description: 'Token application submitted to Google for approval',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '10 minutes'
      },
      {
        id: 'token_approved',
        name: 'Developer Token Approved',
        description: 'Google approves developer token for production use',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '24-48 hours (Google review)'
      },
      {
        id: 'spending_requirement',
        name: 'Account Spending Requirement Met',
        description: '$100+ lifetime spend in manager or linked accounts',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '1-2 weeks (depending on campaign activity)'
      },
      {
        id: 'api_access_working',
        name: 'Full API Access Confirmed',
        description: 'Successful data retrieval from Google Ads API',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '5 minutes (testing)'
      },
      {
        id: 'client_data_tested',
        name: 'Client Data Integration',
        description: 'Successfully fetch data for all client accounts',
        status: 'unknown',
        completedAt: null,
        estimatedTime: '30 minutes (testing all clients)'
      }
    ];
    
    this.overallProgress = 0;
    this.currentPhase = 'unknown';
    this.blockers = [];
    this.nextSteps = [];
    this.estimatedCompletion = null;
  }

  async getCredentials() {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_developer_token',
        'google_ads_manager_customer_id',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_manager_refresh_token'
      ]);
    
    if (error) throw new Error(`Failed to get credentials: ${error.message}`);
    
    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });
    
    return creds;
  }

  async assessMilestoneProgress(credentials) {
    console.log('📊 AUDIT 3: MILESTONE PROGRESS ASSESSMENT');
    console.log('=========================================');
    
    // Check credentials configured
    const credentialsComplete = this.checkCredentialsConfigured(credentials);
    
    // Check OAuth working
    const oauthWorking = await this.checkOAuthWorking(credentials);
    
    // Check API enabled (indirect test)
    const apiEnabled = await this.checkAPIEnabled(credentials, oauthWorking.accessToken);
    
    // Determine current phase and blockers
    this.determineCurrentPhase();
    this.calculateOverallProgress();
    
    return true;
  }

  checkCredentialsConfigured(credentials) {
    const milestone = this.milestones.find(m => m.id === 'credentials_configured');
    
    const checks = [
      credentials.google_ads_developer_token && credentials.google_ads_developer_token.length === 22,
      credentials.google_ads_manager_customer_id && /^\d{3}-\d{3}-\d{4}$/.test(credentials.google_ads_manager_customer_id),
      credentials.google_ads_client_id && credentials.google_ads_client_id.includes('.apps.googleusercontent.com'),
      credentials.google_ads_client_secret && credentials.google_ads_client_secret.startsWith('GOCSPX-'),
      credentials.google_ads_manager_refresh_token && credentials.google_ads_manager_refresh_token.startsWith('1//')
    ];
    
    const allConfigured = checks.every(check => check);
    
    milestone.status = allConfigured ? 'completed' : 'in_progress';
    if (allConfigured) {
      milestone.completedAt = new Date().toISOString();
    }
    
    console.log(`✓ Credentials Configuration: ${milestone.status.toUpperCase()}`);
    console.log(`   Developer Token: ${checks[0] ? '✅' : '❌'}`);
    console.log(`   Manager Customer ID: ${checks[1] ? '✅' : '❌'}`);
    console.log(`   OAuth Client ID: ${checks[2] ? '✅' : '❌'}`);
    console.log(`   OAuth Client Secret: ${checks[3] ? '✅' : '❌'}`);
    console.log(`   Refresh Token: ${checks[4] ? '✅' : '❌'}`);
    
    if (!allConfigured) {
      this.blockers.push('Incomplete credential configuration');
      this.nextSteps.push('Complete all required credential fields');
    }
    
    return allConfigured;
  }

  async checkOAuthWorking(credentials) {
    const milestone = this.milestones.find(m => m.id === 'oauth_working');
    
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: credentials.google_ads_client_id,
          client_secret: credentials.google_ads_client_secret,
          refresh_token: credentials.google_ads_manager_refresh_token,
          grant_type: 'refresh_token'
        })
      });
      
      if (response.ok) {
        const tokenData = await response.json();
        milestone.status = 'completed';
        milestone.completedAt = new Date().toISOString();
        
        console.log(`✓ OAuth Authentication: COMPLETED`);
        console.log(`   Access Token: ${tokenData.access_token.substring(0, 20)}...`);
        console.log(`   Expires In: ${tokenData.expires_in} seconds`);
        
        return { working: true, accessToken: tokenData.access_token };
      } else {
        milestone.status = 'failed';
        console.log(`✗ OAuth Authentication: FAILED`);
        console.log(`   Error: ${response.status}`);
        
        this.blockers.push('OAuth authentication failure');
        this.nextSteps.push('Fix OAuth credentials (Client ID, Secret, or Refresh Token)');
        
        return { working: false, accessToken: null };
      }
      
    } catch (error) {
      milestone.status = 'failed';
      console.log(`✗ OAuth Authentication: ERROR - ${error.message}`);
      
      this.blockers.push('OAuth network connectivity issue');
      this.nextSteps.push('Check network connectivity and OAuth configuration');
      
      return { working: false, accessToken: null };
    }
  }

  async checkAPIEnabled(credentials, accessToken) {
    const apiMilestone = this.milestones.find(m => m.id === 'api_enabled');
    const tokenSubmittedMilestone = this.milestones.find(m => m.id === 'token_submitted');
    const tokenApprovedMilestone = this.milestones.find(m => m.id === 'token_approved');
    const spendingMilestone = this.milestones.find(m => m.id === 'spending_requirement');
    const accessMilestone = this.milestones.find(m => m.id === 'api_access_working');
    
    if (!accessToken) {
      console.log(`✗ API Tests: SKIPPED (no access token)`);
      return false;
    }
    
    try {
      const response = await fetch('https://googleads.googleapis.com/v14/customers:listAccessibleCustomers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': credentials.google_ads_developer_token,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✓ API Connectivity Test: ${response.status}`);
      
      if (response.status === 200) {
        // Full success - all milestones completed
        apiMilestone.status = 'completed';
        tokenSubmittedMilestone.status = 'completed';
        tokenApprovedMilestone.status = 'completed';
        spendingMilestone.status = 'completed';
        accessMilestone.status = 'completed';
        
        const now = new Date().toISOString();
        apiMilestone.completedAt = now;
        tokenSubmittedMilestone.completedAt = now;
        tokenApprovedMilestone.completedAt = now;
        spendingMilestone.completedAt = now;
        accessMilestone.completedAt = now;
        
        console.log(`   🎉 FULL API ACCESS CONFIRMED!`);
        
        const data = await response.json();
        if (data.resourceNames) {
          console.log(`   📊 Accessible Customers: ${data.resourceNames.length}`);
        }
        
        return true;
        
      } else if (response.status === 404) {
        // Most likely: Token not approved yet
        apiMilestone.status = 'completed'; // API is enabled (otherwise would be different error)
        tokenSubmittedMilestone.status = 'completed'; // Token was submitted
        tokenApprovedMilestone.status = 'pending'; // Waiting for approval
        spendingMilestone.status = 'unknown'; // Can't test until approved
        accessMilestone.status = 'blocked'; // Blocked by token approval
        
        console.log(`   ⏳ Developer token pending approval`);
        
        this.blockers.push('Developer token awaiting Google approval');
        this.nextSteps.push('Wait 24-48 hours for Google to approve developer token');
        this.nextSteps.push('Check token status in Google Ads API Center');
        
        return false;
        
      } else if (response.status === 403) {
        // Token approved but insufficient permissions (spending requirement)
        apiMilestone.status = 'completed';
        tokenSubmittedMilestone.status = 'completed';
        tokenApprovedMilestone.status = 'completed';
        spendingMilestone.status = 'pending'; // This is the blocker
        accessMilestone.status = 'blocked';
        
        console.log(`   💰 Token approved but insufficient account spending`);
        
        this.blockers.push('Account needs $100+ lifetime spending');
        this.nextSteps.push('Run campaigns to reach $100+ lifetime spend');
        this.nextSteps.push('Link client accounts with existing spend');
        
        return false;
        
      } else if (response.status === 401) {
        // Authentication issue
        apiMilestone.status = 'completed';
        tokenSubmittedMilestone.status = 'unknown';
        tokenApprovedMilestone.status = 'unknown';
        spendingMilestone.status = 'unknown';
        accessMilestone.status = 'failed';
        
        console.log(`   🔐 Authentication issue`);
        
        this.blockers.push('OAuth authentication problem');
        this.nextSteps.push('Regenerate OAuth refresh token');
        
        return false;
      }
      
    } catch (error) {
      console.log(`✗ API Test: ERROR - ${error.message}`);
      
      apiMilestone.status = 'unknown';
      this.blockers.push('Unable to test API connectivity');
      this.nextSteps.push('Check network connectivity and API configuration');
      
      return false;
    }
  }

  determineCurrentPhase() {
    if (this.blockers.length === 0) {
      this.currentPhase = 'operational';
    } else if (this.blockers.includes('Developer token awaiting Google approval')) {
      this.currentPhase = 'waiting_for_approval';
    } else if (this.blockers.includes('Account needs $100+ lifetime spending')) {
      this.currentPhase = 'building_spend_history';
    } else if (this.blockers.includes('OAuth authentication failure') || this.blockers.includes('OAuth authentication problem')) {
      this.currentPhase = 'fixing_authentication';
    } else if (this.blockers.includes('Incomplete credential configuration')) {
      this.currentPhase = 'configuring_credentials';
    } else {
      this.currentPhase = 'troubleshooting';
    }
  }

  calculateOverallProgress() {
    const completedCount = this.milestones.filter(m => m.status === 'completed').length;
    this.overallProgress = Math.round((completedCount / this.milestones.length) * 100);
    
    // Estimate completion time based on current phase
    const timeEstimates = {
      'configuring_credentials': '1-2 hours',
      'fixing_authentication': '2-4 hours',
      'waiting_for_approval': '24-48 hours',
      'building_spend_history': '1-2 weeks',
      'troubleshooting': '4-8 hours',
      'operational': 'Complete!'
    };
    
    this.estimatedCompletion = timeEstimates[this.currentPhase] || 'Unknown';
  }

  generateProgressReport() {
    console.log('\n📈 PROGRESS TIMELINE REPORT');
    console.log('===========================');
    
    console.log(`\n📊 Overall Progress: ${this.overallProgress}%`);
    console.log(`🎯 Current Phase: ${this.currentPhase.replace(/_/g, ' ').toUpperCase()}`);
    console.log(`⏱️  Estimated Completion: ${this.estimatedCompletion}`);
    
    console.log('\n✅ MILESTONE STATUS:');
    console.log('===================');
    
    this.milestones.forEach((milestone, index) => {
      const statusEmojis = {
        'completed': '✅',
        'in_progress': '🔄',
        'pending': '⏳',
        'blocked': '🚫',
        'failed': '❌',
        'unknown': '❓'
      };
      
      const emoji = statusEmojis[milestone.status] || '❓';
      console.log(`${index + 1}. ${emoji} ${milestone.name}`);
      console.log(`   Status: ${milestone.status.toUpperCase()}`);
      console.log(`   Description: ${milestone.description}`);
      
      if (milestone.completedAt) {
        const completedDate = new Date(milestone.completedAt).toLocaleString();
        console.log(`   Completed: ${completedDate}`);
      } else if (milestone.status === 'pending' || milestone.status === 'in_progress') {
        console.log(`   Estimated Time: ${milestone.estimatedTime}`);
      }
      
      console.log('');
    });
    
    if (this.blockers.length > 0) {
      console.log('🚫 CURRENT BLOCKERS:');
      console.log('===================');
      this.blockers.forEach((blocker, index) => {
        console.log(`   ${index + 1}. ${blocker}`);
      });
      console.log('');
    }
    
    if (this.nextSteps.length > 0) {
      console.log('📝 NEXT STEPS:');
      console.log('==============');
      this.nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
      console.log('');
    }
  }

  generateClientStatusUpdate() {
    console.log('📧 CLIENT STATUS UPDATE');
    console.log('=======================');
    
    const phaseMessages = {
      'configuring_credentials': {
        title: 'Setting Up API Credentials',
        message: 'We are currently configuring the Google Ads API credentials and authentication.',
        clientAction: 'No action needed - technical setup in progress.'
      },
      'fixing_authentication': {
        title: 'Resolving Authentication Issues',
        message: 'We are fixing a technical issue with the OAuth authentication configuration.',
        clientAction: 'No action needed - technical fix in progress.'
      },
      'waiting_for_approval': {
        title: 'Awaiting Google Approval',
        message: 'All technical setup is complete. We are waiting for Google to approve your developer token.',
        clientAction: 'No action needed - this is a standard Google review process that takes 24-48 hours.'
      },
      'building_spend_history': {
        title: 'Building Account Spend History',
        message: 'Your developer token is approved! Your Google Ads account needs $100+ in lifetime spending to access full API features.',
        clientAction: 'Run some test campaigns or link existing client accounts with spend history.'
      },
      'troubleshooting': {
        title: 'Investigating Technical Issue',
        message: 'We are investigating an unexpected technical issue with the API integration.',
        clientAction: 'No action needed - technical investigation in progress.'
      },
      'operational': {
        title: 'Integration Complete!',
        message: 'Your Google Ads API integration is fully operational and ready to use.',
        clientAction: 'The system is ready for production use. You can start using Google Ads data in your reports.'
      }
    };
    
    const currentMessage = phaseMessages[this.currentPhase] || phaseMessages['troubleshooting'];
    
    console.log(`\nStatus: ${currentMessage.title}`);
    console.log(`Progress: ${this.overallProgress}%`);
    console.log(`Timeline: ${this.estimatedCompletion}`);
    console.log('');
    console.log(`Update: ${currentMessage.message}`);
    console.log('');
    console.log(`What you need to do: ${currentMessage.clientAction}`);
    console.log('');
    
    if (this.currentPhase === 'waiting_for_approval') {
      console.log('📋 What happens next:');
      console.log('   1. Google reviews your developer token (24-48 hours)');
      console.log('   2. Once approved, API access will be immediately available');
      console.log('   3. We will run final tests and notify you when complete');
      console.log('');
    } else if (this.currentPhase === 'building_spend_history') {
      console.log('💰 Spending requirement details:');
      console.log('   - Manager account needs $100+ USD lifetime spend, OR');
      console.log('   - Linked client accounts with $100+ combined spend');
      console.log('   - This is a Google requirement for API access');
      console.log('');
    }
    
    console.log('📞 Next update: I will check progress daily and update you with any changes.');
    
    return currentMessage;
  }

  saveProgressHistory() {
    const progressData = {
      timestamp: new Date().toISOString(),
      overallProgress: this.overallProgress,
      currentPhase: this.currentPhase,
      estimatedCompletion: this.estimatedCompletion,
      milestones: this.milestones,
      blockers: this.blockers,
      nextSteps: this.nextSteps
    };
    
    // Try to load existing history
    let history = [];
    try {
      if (fs.existsSync('google-ads-progress-history.json')) {
        const existingData = fs.readFileSync('google-ads-progress-history.json', 'utf8');
        history = JSON.parse(existingData);
      }
    } catch (error) {
      console.log('Note: Starting new progress history file');
    }
    
    // Add current progress to history
    history.push(progressData);
    
    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    history = history.filter(entry => new Date(entry.timestamp) > thirtyDaysAgo);
    
    // Save updated history
    fs.writeFileSync('google-ads-progress-history.json', JSON.stringify(history, null, 2));
    
    console.log('\n💾 Progress saved to history file');
    
    // Show progress trend if we have previous data
    if (history.length > 1) {
      const previous = history[history.length - 2];
      const progressChange = this.overallProgress - previous.overallProgress;
      
      if (progressChange > 0) {
        console.log(`📈 Progress improved: +${progressChange}% since last check`);
      } else if (progressChange === 0) {
        console.log(`📊 Progress unchanged since last check`);
      }
      
      if (previous.currentPhase !== this.currentPhase) {
        console.log(`🔄 Phase changed: ${previous.currentPhase} → ${this.currentPhase}`);
      }
    }
    
    return history;
  }
}

async function main() {
  console.log('📊 TIMELINE & PROGRESS TRACKING AUDIT');
  console.log('=====================================\n');
  
  const audit = new TimelineProgressAudit();
  
  try {
    const credentials = await audit.getCredentials();
    await audit.assessMilestoneProgress(credentials);
    
    audit.generateProgressReport();
    const statusUpdate = audit.generateClientStatusUpdate();
    const history = audit.saveProgressHistory();
    
    console.log('\n📄 SUMMARY');
    console.log('==========');
    console.log(`Current Progress: ${audit.overallProgress}%`);
    console.log(`Current Phase: ${audit.currentPhase}`);
    console.log(`Estimated Completion: ${audit.estimatedCompletion}`);
    console.log(`Blockers: ${audit.blockers.length}`);
    console.log(`Next Steps: ${audit.nextSteps.length}`);
    
  } catch (error) {
    console.error('\n❌ Progress audit failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 