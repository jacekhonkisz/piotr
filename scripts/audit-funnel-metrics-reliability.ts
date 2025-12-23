#!/usr/bin/env node
/**
 * FUNNEL METRICS RELIABILITY AUDIT
 * 
 * Purpose: Check reliability and consistency of conversion funnel data
 * Focuses on: click_to_call, email_contacts, booking steps, reservations
 * Identifies: Missing funnel data, inconsistent patterns, anomalies
 * 
 * Usage: npx tsx scripts/audit-funnel-metrics-reliability.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// TYPES
// ============================================================================

interface FunnelMetrics {
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3?: number;
  reservations: number;
  reservation_value: number;
}

interface CampaignSummary {
  id: string;
  client_id: string;
  summary_type: 'weekly' | 'monthly';
  summary_date: string;
  platform: 'meta' | 'google';
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  click_to_call: number | null;
  email_contacts: number | null;
  booking_step_1: number | null;
  booking_step_2: number | null;
  booking_step_3: number | null;
  reservations: number | null;
  reservation_value: number | null;
  last_updated: string;
}

interface FunnelIssue {
  type: 'missing_all' | 'missing_partial' | 'illogical_funnel' | 'spend_no_conversions' | 'conversions_no_spend' | 'broken_sequence';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  period: string;
  platform: string;
  metrics: Partial<FunnelMetrics>;
}

interface ClientFunnelReport {
  clientId: string;
  clientName: string;
  platform: 'meta' | 'google';
  totalPeriods: number;
  periodsWithSpend: number;
  periodsWithFunnelData: number;
  issues: FunnelIssue[];
  summary: {
    missingFunnelDataRate: number;
    illogicalFunnelRate: number;
    reliabilityScore: number; // 0-100
  };
}

// ============================================================================
// FUNNEL VALIDATION LOGIC
// ============================================================================

function validateFunnelLogic(record: CampaignSummary): FunnelIssue[] {
  const issues: FunnelIssue[] = [];
  const period = `${record.summary_date} (${record.summary_type})`;
  
  // Extract metrics
  const spend = record.total_spend || 0;
  const clicks = record.total_clicks || 0;
  const clickToCall = record.click_to_call || 0;
  const emailContacts = record.email_contacts || 0;
  const bookingStep1 = record.booking_step_1 || 0;
  const bookingStep2 = record.booking_step_2 || 0;
  const bookingStep3 = record.booking_step_3 || 0;
  const reservations = record.reservations || 0;
  const reservationValue = record.reservation_value || 0;
  
  const hasFunnelData = clickToCall > 0 || emailContacts > 0 || bookingStep1 > 0 || 
                        bookingStep2 > 0 || bookingStep3 > 0 || reservations > 0;
  
  // Issue 1: Spend but NO funnel data at all
  if (spend > 100 && !hasFunnelData) {
    issues.push({
      type: 'missing_all',
      severity: 'critical',
      description: `Significant spend (${spend.toFixed(2)} PLN) but ZERO funnel metrics recorded`,
      period,
      platform: record.platform,
      metrics: {
        click_to_call: clickToCall,
        email_contacts: emailContacts,
        booking_step_1: bookingStep1,
        booking_step_2: bookingStep2,
        booking_step_3: bookingStep3,
        reservations: reservations,
        reservation_value: reservationValue
      }
    });
  }
  
  // Issue 2: Missing NULL vs 0 distinction (all are explicitly null)
  const allNull = record.click_to_call === null && 
                  record.email_contacts === null && 
                  record.booking_step_1 === null &&
                  record.reservations === null;
  
  if (spend > 0 && allNull) {
    issues.push({
      type: 'missing_all',
      severity: 'critical',
      description: `Spend exists but all funnel fields are NULL (not collected)`,
      period,
      platform: record.platform,
      metrics: {}
    });
  }
  
  // Issue 3: Illogical funnel progression (step 2 > step 1)
  if (bookingStep2 > bookingStep1 && bookingStep1 > 0) {
    issues.push({
      type: 'illogical_funnel',
      severity: 'warning',
      description: `Booking Step 2 (${bookingStep2}) > Booking Step 1 (${bookingStep1}) - Impossible funnel`,
      period,
      platform: record.platform,
      metrics: {
        booking_step_1: bookingStep1,
        booking_step_2: bookingStep2
      }
    });
  }
  
  // Issue 4: Reservations without any prior funnel steps
  if (reservations > 0 && bookingStep1 === 0 && bookingStep2 === 0 && clickToCall === 0 && emailContacts === 0) {
    issues.push({
      type: 'broken_sequence',
      severity: 'warning',
      description: `${reservations} reservations but zero lead generation actions (no clicks to call, emails, or booking steps)`,
      period,
      platform: record.platform,
      metrics: {
        reservations: reservations,
        click_to_call: clickToCall,
        email_contacts: emailContacts,
        booking_step_1: bookingStep1
      }
    });
  }
  
  // Issue 5: Reservation value without reservations
  if (reservationValue > 0 && reservations === 0) {
    issues.push({
      type: 'illogical_funnel',
      severity: 'warning',
      description: `Reservation value (${reservationValue.toFixed(2)} PLN) exists but 0 reservations`,
      period,
      platform: record.platform,
      metrics: {
        reservations: reservations,
        reservation_value: reservationValue
      }
    });
  }
  
  // Issue 6: Conversions exist but no spend (possible attribution issue)
  if (reservations > 0 && spend === 0) {
    issues.push({
      type: 'conversions_no_spend',
      severity: 'info',
      description: `${reservations} reservations recorded but 0 spend (organic or attribution issue?)`,
      period,
      platform: record.platform,
      metrics: {
        reservations: reservations,
        reservation_value: reservationValue
      }
    });
  }
  
  // Issue 7: Only partial funnel data (some metrics missing)
  const hasSomeData = (clickToCall > 0 ? 1 : 0) + 
                      (emailContacts > 0 ? 1 : 0) + 
                      (bookingStep1 > 0 ? 1 : 0) + 
                      (reservations > 0 ? 1 : 0);
  
  if (spend > 100 && hasSomeData > 0 && hasSomeData < 2) {
    issues.push({
      type: 'missing_partial',
      severity: 'warning',
      description: `Only ${hasSomeData} funnel metric(s) recorded despite spend of ${spend.toFixed(2)} PLN`,
      period,
      platform: record.platform,
      metrics: {
        click_to_call: clickToCall,
        email_contacts: emailContacts,
        booking_step_1: bookingStep1,
        reservations: reservations
      }
    });
  }
  
  return issues;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getAllClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, google_ads_customer_id')
    .order('name');
  
  if (error) {
    console.error('❌ Error fetching clients:', error);
    return [];
  }
  
  return data || [];
}

async function getCampaignSummaries(clientId: string, platform: 'meta' | 'google') {
  // Get last 6 months of data
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .gte('summary_date', startDate)
    .order('summary_date', { ascending: true });
  
  if (error) {
    console.error(`❌ Error fetching summaries for ${clientId}:`, error.message);
    return [];
  }
  
  return (data || []) as CampaignSummary[];
}

// ============================================================================
// ANALYSIS
// ============================================================================

async function analyzeClientFunnelData(
  clientId: string, 
  clientName: string, 
  platform: 'meta' | 'google'
): Promise<ClientFunnelReport | null> {
  
  const summaries = await getCampaignSummaries(clientId, platform);
  
  if (summaries.length === 0) {
    return null; // No data for this platform
  }
  
  const allIssues: FunnelIssue[] = [];
  let periodsWithSpend = 0;
  let periodsWithFunnelData = 0;
  
  for (const summary of summaries) {
    if (summary.total_spend > 0) {
      periodsWithSpend++;
    }
    
    const hasFunnelData = (summary.click_to_call || 0) > 0 || 
                          (summary.email_contacts || 0) > 0 || 
                          (summary.booking_step_1 || 0) > 0 || 
                          (summary.reservations || 0) > 0;
    
    if (hasFunnelData) {
      periodsWithFunnelData++;
    }
    
    const issues = validateFunnelLogic(summary);
    allIssues.push(...issues);
  }
  
  // Calculate reliability metrics
  const missingFunnelDataRate = periodsWithSpend > 0 
    ? ((periodsWithSpend - periodsWithFunnelData) / periodsWithSpend) * 100 
    : 0;
  
  const illogicalFunnels = allIssues.filter(i => 
    i.type === 'illogical_funnel' || i.type === 'broken_sequence'
  ).length;
  
  const illogicalFunnelRate = summaries.length > 0 
    ? (illogicalFunnels / summaries.length) * 100 
    : 0;
  
  // Reliability score (0-100, higher is better)
  const reliabilityScore = Math.max(0, 
    100 - missingFunnelDataRate - (illogicalFunnelRate * 2)
  );
  
  return {
    clientId,
    clientName,
    platform,
    totalPeriods: summaries.length,
    periodsWithSpend,
    periodsWithFunnelData,
    issues: allIssues,
    summary: {
      missingFunnelDataRate,
      illogicalFunnelRate,
      reliabilityScore
    }
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function printClientReport(report: ClientFunnelReport) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ${report.clientName} - ${report.platform.toUpperCase()} FUNNEL AUDIT`);
  console.log('='.repeat(80));
  
  console.log(`\n📈 OVERVIEW:`);
  console.log(`   Total Periods Analyzed: ${report.totalPeriods}`);
  console.log(`   Periods with Spend: ${report.periodsWithSpend}`);
  console.log(`   Periods with Funnel Data: ${report.periodsWithFunnelData}`);
  
  console.log(`\n📊 RELIABILITY METRICS:`);
  console.log(`   Missing Funnel Data Rate: ${report.summary.missingFunnelDataRate.toFixed(1)}%`);
  console.log(`   Illogical Funnel Rate: ${report.summary.illogicalFunnelRate.toFixed(1)}%`);
  console.log(`   Overall Reliability Score: ${report.summary.reliabilityScore.toFixed(1)}/100`);
  
  // Color-code reliability
  let reliabilityLabel = '🔴 POOR';
  if (report.summary.reliabilityScore >= 80) reliabilityLabel = '✅ EXCELLENT';
  else if (report.summary.reliabilityScore >= 60) reliabilityLabel = '⚠️ FAIR';
  else if (report.summary.reliabilityScore >= 40) reliabilityLabel = '⚠️ NEEDS IMPROVEMENT';
  
  console.log(`   Status: ${reliabilityLabel}`);
  
  if (report.issues.length > 0) {
    console.log(`\n🚨 ISSUES FOUND (${report.issues.length}):`);
    
    // Group by severity
    const critical = report.issues.filter(i => i.severity === 'critical');
    const warnings = report.issues.filter(i => i.severity === 'warning');
    const info = report.issues.filter(i => i.severity === 'info');
    
    if (critical.length > 0) {
      console.log(`\n   🔴 CRITICAL (${critical.length}):`);
      critical.slice(0, 5).forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.description}`);
        console.log(`      Period: ${issue.period}`);
      });
      if (critical.length > 5) {
        console.log(`      ... and ${critical.length - 5} more critical issues`);
      }
    }
    
    if (warnings.length > 0) {
      console.log(`\n   ⚠️ WARNINGS (${warnings.length}):`);
      warnings.slice(0, 3).forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.description}`);
        console.log(`      Period: ${issue.period}`);
      });
      if (warnings.length > 3) {
        console.log(`      ... and ${warnings.length - 3} more warnings`);
      }
    }
    
    if (info.length > 0) {
      console.log(`\n   ℹ️ INFO (${info.length}):`);
      console.log(`      ${info.length} informational notice(s)`);
    }
  } else {
    console.log(`\n✅ NO ISSUES FOUND - Funnel data looks consistent!`);
  }
}

function generateDetailedReport(reports: ClientFunnelReport[]): string {
  let md = `# 🔍 FUNNEL METRICS RELIABILITY AUDIT REPORT\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `---\n\n`;
  
  // Overall summary
  md += `## 📊 EXECUTIVE SUMMARY\n\n`;
  
  const totalClients = reports.length;
  const excellentClients = reports.filter(r => r.summary.reliabilityScore >= 80).length;
  const fairClients = reports.filter(r => r.summary.reliabilityScore >= 60 && r.summary.reliabilityScore < 80).length;
  const poorClients = reports.filter(r => r.summary.reliabilityScore < 60).length;
  
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Client-Platform Combinations Analyzed | ${totalClients} |\n`;
  md += `| Excellent Reliability (80-100) | ${excellentClients} |\n`;
  md += `| Fair Reliability (60-79) | ${fairClients} |\n`;
  md += `| Poor Reliability (<60) | ${poorClients} |\n`;
  
  const totalIssues = reports.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalIssues = reports.reduce((sum, r) => 
    sum + r.issues.filter(i => i.severity === 'critical').length, 0
  );
  
  md += `| Total Issues Found | ${totalIssues} |\n`;
  md += `| Critical Issues | ${criticalIssues} |\n\n`;
  
  // Reliability ranking
  md += `## 🏆 RELIABILITY RANKING\n\n`;
  md += `| Rank | Client | Platform | Score | Status |\n`;
  md += `|------|--------|----------|-------|--------|\n`;
  
  const sorted = [...reports].sort((a, b) => b.summary.reliabilityScore - a.summary.reliabilityScore);
  sorted.forEach((r, i) => {
    let status = '🔴';
    if (r.summary.reliabilityScore >= 80) status = '✅';
    else if (r.summary.reliabilityScore >= 60) status = '⚠️';
    
    md += `| ${i + 1} | ${r.clientName} | ${r.platform.toUpperCase()} | ${r.summary.reliabilityScore.toFixed(1)} | ${status} |\n`;
  });
  
  md += `\n---\n\n`;
  
  // Detailed client reports
  md += `## 📋 DETAILED CLIENT REPORTS\n\n`;
  
  reports.forEach(report => {
    md += `### ${report.clientName} - ${report.platform.toUpperCase()}\n\n`;
    md += `**Reliability Score:** ${report.summary.reliabilityScore.toFixed(1)}/100\n\n`;
    md += `**Periods Analyzed:** ${report.totalPeriods} | **With Spend:** ${report.periodsWithSpend} | **With Funnel Data:** ${report.periodsWithFunnelData}\n\n`;
    
    if (report.issues.length > 0) {
      md += `**Issues Found:** ${report.issues.length}\n\n`;
      
      const critical = report.issues.filter(i => i.severity === 'critical');
      const warnings = report.issues.filter(i => i.severity === 'warning');
      
      if (critical.length > 0) {
        md += `🔴 **Critical Issues (${critical.length}):**\n`;
        critical.slice(0, 5).forEach(issue => {
          md += `- ${issue.description} (${issue.period})\n`;
        });
        if (critical.length > 5) {
          md += `- ... and ${critical.length - 5} more\n`;
        }
        md += `\n`;
      }
      
      if (warnings.length > 0) {
        md += `⚠️ **Warnings (${warnings.length}):**\n`;
        warnings.slice(0, 3).forEach(issue => {
          md += `- ${issue.description} (${issue.period})\n`;
        });
        if (warnings.length > 3) {
          md += `- ... and ${warnings.length - 3} more\n`;
        }
        md += `\n`;
      }
    } else {
      md += `✅ No issues found\n\n`;
    }
    
    md += `---\n\n`;
  });
  
  return md;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔍 FUNNEL METRICS RELIABILITY AUDIT');
  console.log('='.repeat(80));
  console.log();
  console.log('📊 Analyzing conversion funnel data quality for all clients...');
  console.log('🔍 Checking: click_to_call, email_contacts, booking steps, reservations');
  console.log();
  
  const clients = await getAllClients();
  console.log(`✅ Found ${clients.length} clients\n`);
  
  const reports: ClientFunnelReport[] = [];
  
  for (const client of clients) {
    // Analyze Meta if available
    if (client.ad_account_id) {
      const metaReport = await analyzeClientFunnelData(client.id, client.name, 'meta');
      if (metaReport) {
        reports.push(metaReport);
        printClientReport(metaReport);
      }
    }
    
    // Analyze Google Ads if available
    if (client.google_ads_customer_id) {
      const googleReport = await analyzeClientFunnelData(client.id, client.name, 'google');
      if (googleReport) {
        reports.push(googleReport);
        printClientReport(googleReport);
      }
    }
  }
  
  // Generate detailed report
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📄 GENERATING DETAILED REPORT');
  console.log('='.repeat(80));
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const reportContent = generateDetailedReport(reports);
  const filename = `FUNNEL_METRICS_AUDIT_${timestamp}.md`;
  
  fs.writeFileSync(filename, reportContent);
  console.log(`\n✅ Report saved: ${filename}`);
  
  // Final summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  
  const excellentCount = reports.filter(r => r.summary.reliabilityScore >= 80).length;
  const poorCount = reports.filter(r => r.summary.reliabilityScore < 60).length;
  const totalIssues = reports.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalIssues = reports.reduce((sum, r) => 
    sum + r.issues.filter(i => i.severity === 'critical').length, 0
  );
  
  console.log(`\n✅ Analyzed ${reports.length} client-platform combinations`);
  console.log(`\n📊 RELIABILITY BREAKDOWN:`);
  console.log(`   ✅ Excellent (80-100): ${excellentCount}`);
  console.log(`   ⚠️ Fair (60-79): ${reports.filter(r => r.summary.reliabilityScore >= 60 && r.summary.reliabilityScore < 80).length}`);
  console.log(`   🔴 Poor (<60): ${poorCount}`);
  
  console.log(`\n🚨 ISSUES FOUND:`);
  console.log(`   Total: ${totalIssues}`);
  console.log(`   Critical: ${criticalIssues}`);
  
  if (criticalIssues > 0) {
    console.log(`\n⚠️ ${criticalIssues} CRITICAL ISSUES require immediate attention!`);
    console.log(`   These indicate missing or severely unreliable funnel data.`);
  }
  
  console.log(`\n📄 Detailed report: ${filename}`);
  console.log();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

