#!/usr/bin/env node
/**
 * COMPREHENSIVE YEAR-OVER-YEAR DATA COMPARISON SCRIPT
 * 
 * Purpose: Compare all clients' data for the past 12 months
 * Checks: Both weekly and monthly data completeness
 * Identifies: Missing data, anomalies, December 2024 issues
 * 
 * Usage: npx tsx scripts/compare-all-clients-year-data.ts
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
// TYPES & INTERFACES
// ============================================================================

interface Client {
  id: string;
  name: string;
  email: string;
  ad_account_id: string | null;
  google_ads_customer_id: string | null;
  api_status: string;
  reporting_frequency: 'weekly' | 'monthly';
}

interface MonthData {
  month: string; // YYYY-MM format
  metaExists: boolean;
  googleExists: boolean;
  metaSpend: number;
  googleSpend: number;
  metaImpressions: number;
  googleImpressions: number;
  metaConversions: number;
  googleConversions: number;
  lastUpdated: string | null;
}

interface WeekData {
  week: string; // YYYY-Www format
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  metaExists: boolean;
  googleExists: boolean;
  metaSpend: number;
  googleSpend: number;
  metaImpressions: number;
  googleImpressions: number;
  metaConversions: number;
  googleConversions: number;
  lastUpdated: string | null;
}

interface ClientReport {
  client: Client;
  monthlyData: MonthData[];
  weeklyData: WeekData[];
  summary: {
    totalMonthsExpected: number;
    metaMonthsFound: number;
    googleMonthsFound: number;
    totalWeeksExpected: number;
    metaWeeksFound: number;
    googleWeeksFound: number;
    missingMonths: string[];
    missingWeeks: string[];
    anomalies: string[];
  };
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMonthsBetween(startDate: Date, endDate: Date): string[] {
  const months: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

function getWeeksBetween(startDate: Date, endDate: Date): Array<{ week: string; start: string; end: string }> {
  const weeks: Array<{ week: string; start: string; end: string }> = [];
  const current = new Date(startDate);
  
  // Start from the first Monday
  current.setDate(current.getDate() - (current.getDay() === 0 ? 6 : current.getDay() - 1));
  
  while (current <= endDate) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const year = weekStart.getFullYear();
    const weekNum = getWeekNumber(weekStart);
    
    weeks.push({
      week: `${year}-W${String(weekNum).padStart(2, '0')}`,
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0]
    });
    
    current.setDate(current.getDate() + 7);
  }
  
  return weeks;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getAllClients(): Promise<Client[]> {
  console.log('📋 Fetching all clients...\n');
  
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email, ad_account_id, google_ads_customer_id, api_status, reporting_frequency')
    .order('name');
  
  if (error) {
    console.error('❌ Error fetching clients:', error);
    return [];
  }
  
  console.log(`✅ Found ${data.length} clients\n`);
  return data as Client[];
}

async function getMonthlyDataForClient(clientId: string, months: string[]): Promise<Map<string, any>> {
  const dataMap = new Map();
  
  // Fetch all monthly summaries for this client in the date range
  const startDate = `${months[0]}-01`;
  const endMonth = months[months.length - 1];
  const endDate = `${endMonth}-31`;
  
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .gte('summary_date', startDate)
    .lte('summary_date', endDate)
    .order('summary_date', { ascending: true });
  
  if (error) {
    console.error(`   ❌ Error fetching monthly data for client ${clientId}:`, error.message);
    return dataMap;
  }
  
  // Map data by month (YYYY-MM)
  data?.forEach(record => {
    const month = record.summary_date.substring(0, 7); // Extract YYYY-MM
    const platform = record.platform || 'meta';
    
    if (!dataMap.has(month)) {
      dataMap.set(month, {});
    }
    
    dataMap.get(month)[platform] = record;
  });
  
  return dataMap;
}

async function getWeeklyDataForClient(clientId: string, weeks: Array<{ week: string; start: string; end: string }>): Promise<Map<string, any>> {
  const dataMap = new Map();
  
  if (weeks.length === 0) return dataMap;
  
  const startDate = weeks[0].start;
  const endDate = weeks[weeks.length - 1].end;
  
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'weekly')
    .gte('summary_date', startDate)
    .lte('summary_date', endDate)
    .order('summary_date', { ascending: true });
  
  if (error) {
    console.error(`   ❌ Error fetching weekly data for client ${clientId}:`, error.message);
    return dataMap;
  }
  
  // Map data by week start date
  data?.forEach(record => {
    const weekStart = record.summary_date;
    const platform = record.platform || 'meta';
    
    if (!dataMap.has(weekStart)) {
      dataMap.set(weekStart, {});
    }
    
    dataMap.get(weekStart)[platform] = record;
  });
  
  return dataMap;
}

// ============================================================================
// ANALYSIS
// ============================================================================

async function analyzeClient(client: Client, months: string[], weeks: Array<{ week: string; start: string; end: string }>): Promise<ClientReport> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ANALYZING: ${client.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`   ID: ${client.id}`);
  console.log(`   Email: ${client.email}`);
  console.log(`   Meta Ad Account: ${client.ad_account_id || 'N/A'}`);
  console.log(`   Google Ads Customer: ${client.google_ads_customer_id || 'N/A'}`);
  console.log(`   Reporting Frequency: ${client.reporting_frequency || 'N/A'}`);
  console.log(`   API Status: ${client.api_status}`);
  
  // Fetch data
  const monthlyDataMap = await getMonthlyDataForClient(client.id, months);
  const weeklyDataMap = await getWeeklyDataForClient(client.id, weeks);
  
  // Process monthly data
  const monthlyData: MonthData[] = months.map(month => {
    const data = monthlyDataMap.get(month) || {};
    const metaRecord = data.meta;
    const googleRecord = data.google;
    
    return {
      month,
      metaExists: !!metaRecord,
      googleExists: !!googleRecord,
      metaSpend: metaRecord?.total_spend || 0,
      googleSpend: googleRecord?.total_spend || 0,
      metaImpressions: metaRecord?.total_impressions || 0,
      googleImpressions: googleRecord?.total_impressions || 0,
      metaConversions: metaRecord?.reservations || metaRecord?.total_conversions || 0,
      googleConversions: googleRecord?.reservations || googleRecord?.total_conversions || 0,
      lastUpdated: metaRecord?.last_updated || googleRecord?.last_updated || null
    };
  });
  
  // Process weekly data
  const weeklyData: WeekData[] = weeks.map(weekInfo => {
    const data = weeklyDataMap.get(weekInfo.start) || {};
    const metaRecord = data.meta;
    const googleRecord = data.google;
    
    return {
      week: weekInfo.week,
      weekStart: weekInfo.start,
      weekEnd: weekInfo.end,
      metaExists: !!metaRecord,
      googleExists: !!googleRecord,
      metaSpend: metaRecord?.total_spend || 0,
      googleSpend: googleRecord?.total_spend || 0,
      metaImpressions: metaRecord?.total_impressions || 0,
      googleImpressions: googleRecord?.total_impressions || 0,
      metaConversions: metaRecord?.reservations || metaRecord?.total_conversions || 0,
      googleConversions: googleRecord?.reservations || googleRecord?.total_conversions || 0,
      lastUpdated: metaRecord?.last_updated || googleRecord?.last_updated || null
    };
  });
  
  // Calculate summary
  const metaMonthsFound = monthlyData.filter(m => m.metaExists).length;
  const googleMonthsFound = monthlyData.filter(m => m.googleExists).length;
  const metaWeeksFound = weeklyData.filter(w => w.metaExists).length;
  const googleWeeksFound = weeklyData.filter(w => w.googleExists).length;
  
  const missingMonths: string[] = [];
  const missingWeeks: string[] = [];
  const anomalies: string[] = [];
  
  // Check for missing months (if client has Meta or Google Ads)
  if (client.ad_account_id) {
    monthlyData.forEach(m => {
      if (!m.metaExists) {
        missingMonths.push(`${m.month} (Meta)`);
      }
      // Check for zero spend anomaly
      if (m.metaExists && m.metaSpend === 0 && m.metaImpressions === 0) {
        anomalies.push(`${m.month} (Meta): Zero data despite record existing`);
      }
    });
  }
  
  if (client.google_ads_customer_id) {
    monthlyData.forEach(m => {
      if (!m.googleExists) {
        missingMonths.push(`${m.month} (Google)`);
      }
      // Check for zero spend anomaly
      if (m.googleExists && m.googleSpend === 0 && m.googleImpressions === 0) {
        anomalies.push(`${m.month} (Google): Zero data despite record existing`);
      }
    });
  }
  
  // Check for missing weeks
  if (client.ad_account_id) {
    weeklyData.forEach(w => {
      if (!w.metaExists) {
        missingWeeks.push(`${w.week} (Meta)`);
      }
      // Check for zero spend anomaly
      if (w.metaExists && w.metaSpend === 0 && w.metaImpressions === 0) {
        anomalies.push(`${w.week} (Meta): Zero data despite record existing`);
      }
    });
  }
  
  if (client.google_ads_customer_id) {
    weeklyData.forEach(w => {
      if (!w.googleExists) {
        missingWeeks.push(`${w.week} (Google)`);
      }
      // Check for zero spend anomaly
      if (w.googleExists && w.googleSpend === 0 && w.googleImpressions === 0) {
        anomalies.push(`${w.week} (Google): Zero data despite record existing`);
      }
    });
  }
  
  const summary = {
    totalMonthsExpected: months.length,
    metaMonthsFound,
    googleMonthsFound,
    totalWeeksExpected: weeks.length,
    metaWeeksFound,
    googleWeeksFound,
    missingMonths,
    missingWeeks,
    anomalies
  };
  
  // Print summary
  console.log(`\n📈 MONTHLY DATA SUMMARY:`);
  console.log(`   Expected months: ${summary.totalMonthsExpected}`);
  if (client.ad_account_id) {
    console.log(`   Meta months found: ${metaMonthsFound}/${summary.totalMonthsExpected} (${((metaMonthsFound/summary.totalMonthsExpected)*100).toFixed(1)}%)`);
  }
  if (client.google_ads_customer_id) {
    console.log(`   Google months found: ${googleMonthsFound}/${summary.totalMonthsExpected} (${((googleMonthsFound/summary.totalMonthsExpected)*100).toFixed(1)}%)`);
  }
  
  console.log(`\n📅 WEEKLY DATA SUMMARY:`);
  console.log(`   Expected weeks: ${summary.totalWeeksExpected}`);
  if (client.ad_account_id) {
    console.log(`   Meta weeks found: ${metaWeeksFound}/${summary.totalWeeksExpected} (${((metaWeeksFound/summary.totalWeeksExpected)*100).toFixed(1)}%)`);
  }
  if (client.google_ads_customer_id) {
    console.log(`   Google weeks found: ${googleWeeksFound}/${summary.totalWeeksExpected} (${((googleWeeksFound/summary.totalWeeksExpected)*100).toFixed(1)}%)`);
  }
  
  // Print missing data
  if (missingMonths.length > 0) {
    console.log(`\n⚠️  MISSING MONTHLY DATA (${missingMonths.length}):`);
    missingMonths.slice(0, 10).forEach(m => console.log(`     - ${m}`));
    if (missingMonths.length > 10) {
      console.log(`     ... and ${missingMonths.length - 10} more`);
    }
  }
  
  if (missingWeeks.length > 0) {
    console.log(`\n⚠️  MISSING WEEKLY DATA (${missingWeeks.length}):`);
    missingWeeks.slice(0, 10).forEach(w => console.log(`     - ${w}`));
    if (missingWeeks.length > 10) {
      console.log(`     ... and ${missingWeeks.length - 10} more`);
    }
  }
  
  // Print anomalies
  if (anomalies.length > 0) {
    console.log(`\n🚨 DATA ANOMALIES (${anomalies.length}):`);
    anomalies.slice(0, 10).forEach(a => console.log(`     - ${a}`));
    if (anomalies.length > 10) {
      console.log(`     ... and ${anomalies.length - 10} more`);
    }
  }
  
  // Check specifically for December 2024 issue
  const dec2024 = monthlyData.find(m => m.month === '2024-12');
  if (dec2024) {
    console.log(`\n🔍 DECEMBER 2024 SPECIFIC CHECK:`);
    if (client.ad_account_id) {
      console.log(`   Meta: ${dec2024.metaExists ? '✅' : '❌'} ${dec2024.metaExists ? `(Spend: ${dec2024.metaSpend.toFixed(2)}, Impressions: ${dec2024.metaImpressions})` : 'NO DATA'}`);
    }
    if (client.google_ads_customer_id) {
      console.log(`   Google: ${dec2024.googleExists ? '✅' : '❌'} ${dec2024.googleExists ? `(Spend: ${dec2024.googleSpend.toFixed(2)}, Impressions: ${dec2024.googleImpressions})` : 'NO DATA'}`);
    }
  } else {
    console.log(`\n🔍 DECEMBER 2024: NOT IN ANALYSIS RANGE`);
  }
  
  return {
    client,
    monthlyData,
    weeklyData,
    summary
  };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function generateCSVReport(reports: ClientReport[], months: string[], weeks: Array<{ week: string; start: string; end: string }>): string {
  let csv = 'Client Name,Client ID,Platform,Period Type,Period,Has Data,Spend,Impressions,Conversions,Last Updated\n';
  
  reports.forEach(report => {
    const clientName = report.client.name.replace(/,/g, ';');
    const clientId = report.client.id;
    
    // Monthly data
    report.monthlyData.forEach(m => {
      if (report.client.ad_account_id) {
        csv += `${clientName},${clientId},Meta,Monthly,${m.month},${m.metaExists ? 'Yes' : 'No'},${m.metaSpend.toFixed(2)},${m.metaImpressions},${m.metaConversions},${m.lastUpdated || 'N/A'}\n`;
      }
      if (report.client.google_ads_customer_id) {
        csv += `${clientName},${clientId},Google,Monthly,${m.month},${m.googleExists ? 'Yes' : 'No'},${m.googleSpend.toFixed(2)},${m.googleImpressions},${m.googleConversions},${m.lastUpdated || 'N/A'}\n`;
      }
    });
    
    // Weekly data
    report.weeklyData.forEach(w => {
      if (report.client.ad_account_id) {
        csv += `${clientName},${clientId},Meta,Weekly,${w.week},${w.metaExists ? 'Yes' : 'No'},${w.metaSpend.toFixed(2)},${w.metaImpressions},${w.metaConversions},${w.lastUpdated || 'N/A'}\n`;
      }
      if (report.client.google_ads_customer_id) {
        csv += `${clientName},${clientId},Google,Weekly,${w.week},${w.googleExists ? 'Yes' : 'No'},${w.googleSpend.toFixed(2)},${w.googleImpressions},${w.googleConversions},${w.lastUpdated || 'N/A'}\n`;
      }
    });
  });
  
  return csv;
}

function generateMarkdownReport(reports: ClientReport[], months: string[]): string {
  let md = `# 📊 YEAR-OVER-YEAR CLIENT DATA COMPARISON REPORT\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Analysis Period:** ${months[0]} to ${months[months.length - 1]}\n\n`;
  md += `---\n\n`;
  
  // Overall Summary
  md += `## 📈 OVERALL SUMMARY\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Clients Analyzed | ${reports.length} |\n`;
  
  const clientsWithMeta = reports.filter(r => r.client.ad_account_id).length;
  const clientsWithGoogle = reports.filter(r => r.client.google_ads_customer_id).length;
  md += `| Clients with Meta Ads | ${clientsWithMeta} |\n`;
  md += `| Clients with Google Ads | ${clientsWithGoogle} |\n`;
  
  const totalMissingMonths = reports.reduce((sum, r) => sum + r.summary.missingMonths.length, 0);
  const totalMissingWeeks = reports.reduce((sum, r) => sum + r.summary.missingWeeks.length, 0);
  const totalAnomalies = reports.reduce((sum, r) => sum + r.summary.anomalies.length, 0);
  
  md += `| Total Missing Monthly Records | ${totalMissingMonths} |\n`;
  md += `| Total Missing Weekly Records | ${totalMissingWeeks} |\n`;
  md += `| Total Data Anomalies | ${totalAnomalies} |\n\n`;
  
  // December 2024 Analysis
  md += `## 🔍 DECEMBER 2024 SPECIFIC ANALYSIS\n\n`;
  md += `| Client | Meta Status | Meta Spend | Google Status | Google Spend |\n`;
  md += `|--------|-------------|------------|---------------|-------------|\n`;
  
  reports.forEach(report => {
    const dec2024 = report.monthlyData.find(m => m.month === '2024-12');
    if (dec2024) {
      const metaStatus = report.client.ad_account_id ? (dec2024.metaExists ? '✅' : '❌') : 'N/A';
      const metaSpend = report.client.ad_account_id ? dec2024.metaSpend.toFixed(2) : 'N/A';
      const googleStatus = report.client.google_ads_customer_id ? (dec2024.googleExists ? '✅' : '❌') : 'N/A';
      const googleSpend = report.client.google_ads_customer_id ? dec2024.googleSpend.toFixed(2) : 'N/A';
      
      md += `| ${report.client.name} | ${metaStatus} | ${metaSpend} | ${googleStatus} | ${googleSpend} |\n`;
    }
  });
  
  md += `\n---\n\n`;
  
  // Client-by-Client Details
  md += `## 📋 CLIENT-BY-CLIENT DETAILS\n\n`;
  
  reports.forEach(report => {
    md += `### ${report.client.name}\n\n`;
    md += `**ID:** ${report.client.id}\n\n`;
    md += `**Platforms:** `;
    const platforms = [];
    if (report.client.ad_account_id) platforms.push('Meta');
    if (report.client.google_ads_customer_id) platforms.push('Google Ads');
    md += platforms.join(', ') || 'None';
    md += `\n\n`;
    
    md += `**Monthly Data Completeness:**\n`;
    if (report.client.ad_account_id) {
      md += `- Meta: ${report.summary.metaMonthsFound}/${report.summary.totalMonthsExpected} (${((report.summary.metaMonthsFound/report.summary.totalMonthsExpected)*100).toFixed(1)}%)\n`;
    }
    if (report.client.google_ads_customer_id) {
      md += `- Google: ${report.summary.googleMonthsFound}/${report.summary.totalMonthsExpected} (${((report.summary.googleMonthsFound/report.summary.totalMonthsExpected)*100).toFixed(1)}%)\n`;
    }
    md += `\n`;
    
    md += `**Weekly Data Completeness:**\n`;
    if (report.client.ad_account_id) {
      md += `- Meta: ${report.summary.metaWeeksFound}/${report.summary.totalWeeksExpected} (${((report.summary.metaWeeksFound/report.summary.totalWeeksExpected)*100).toFixed(1)}%)\n`;
    }
    if (report.client.google_ads_customer_id) {
      md += `- Google: ${report.summary.googleWeeksFound}/${report.summary.totalWeeksExpected} (${((report.summary.googleWeeksFound/report.summary.totalWeeksExpected)*100).toFixed(1)}%)\n`;
    }
    md += `\n`;
    
    if (report.summary.missingMonths.length > 0) {
      md += `**⚠️ Missing Monthly Data:** ${report.summary.missingMonths.length} periods\n`;
      md += report.summary.missingMonths.slice(0, 5).map(m => `- ${m}`).join('\n');
      if (report.summary.missingMonths.length > 5) {
        md += `\n- ... and ${report.summary.missingMonths.length - 5} more`;
      }
      md += `\n\n`;
    }
    
    if (report.summary.anomalies.length > 0) {
      md += `**🚨 Data Anomalies:** ${report.summary.anomalies.length} found\n`;
      md += report.summary.anomalies.slice(0, 5).map(a => `- ${a}`).join('\n');
      if (report.summary.anomalies.length > 5) {
        md += `\n- ... and ${report.summary.anomalies.length - 5} more`;
      }
      md += `\n\n`;
    }
    
    md += `---\n\n`;
  });
  
  return md;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 COMPREHENSIVE YEAR-OVER-YEAR CLIENT DATA COMPARISON');
  console.log('='.repeat(80));
  console.log();
  
  // Define analysis period (last 13 months to include December 2024)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 13);
  startDate.setDate(1); // First day of the month
  
  console.log(`📅 Analysis Period:`);
  console.log(`   Start: ${formatDate(startDate)}`);
  console.log(`   End: ${formatDate(endDate)}`);
  console.log();
  
  // Generate list of months and weeks
  const months = getMonthsBetween(startDate, endDate);
  const weeks = getWeeksBetween(startDate, endDate);
  
  console.log(`📊 Periods to analyze:`);
  console.log(`   Months: ${months.length} (${months[0]} to ${months[months.length - 1]})`);
  console.log(`   Weeks: ${weeks.length} (${weeks[0].week} to ${weeks[weeks.length - 1].week})`);
  console.log();
  
  // Get all clients
  const clients = await getAllClients();
  
  if (clients.length === 0) {
    console.log('❌ No clients found. Exiting.');
    return;
  }
  
  // Analyze each client
  const reports: ClientReport[] = [];
  
  for (const client of clients) {
    const report = await analyzeClient(client, months, weeks);
    reports.push(report);
  }
  
  // Generate reports
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📄 GENERATING REPORTS');
  console.log('='.repeat(80));
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  // CSV Report
  const csvContent = generateCSVReport(reports, months, weeks);
  const csvFilename = `client-data-comparison-${timestamp}.csv`;
  fs.writeFileSync(csvFilename, csvContent);
  console.log(`\n✅ CSV Report saved: ${csvFilename}`);
  
  // Markdown Report
  const mdContent = generateMarkdownReport(reports, months);
  const mdFilename = `CLIENT_DATA_COMPARISON_${timestamp}.md`;
  fs.writeFileSync(mdFilename, mdContent);
  console.log(`✅ Markdown Report saved: ${mdFilename}`);
  
  // Console Summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Analyzed ${reports.length} clients`);
  console.log(`📅 Period: ${months[0]} to ${months[months.length - 1]}`);
  
  const totalIssues = reports.reduce((sum, r) => 
    sum + r.summary.missingMonths.length + r.summary.missingWeeks.length + r.summary.anomalies.length, 0
  );
  
  if (totalIssues > 0) {
    console.log(`\n⚠️  TOTAL ISSUES FOUND: ${totalIssues}`);
    console.log(`   - Missing monthly records: ${reports.reduce((sum, r) => sum + r.summary.missingMonths.length, 0)}`);
    console.log(`   - Missing weekly records: ${reports.reduce((sum, r) => sum + r.summary.missingWeeks.length, 0)}`);
    console.log(`   - Data anomalies: ${reports.reduce((sum, r) => sum + r.summary.anomalies.length, 0)}`);
  } else {
    console.log(`\n✅ NO ISSUES FOUND - All data is complete!`);
  }
  
  // December 2024 specific summary
  const dec2024Issues = reports.filter(r => {
    const dec = r.monthlyData.find(m => m.month === '2024-12');
    return dec && (
      (r.client.ad_account_id && !dec.metaExists) ||
      (r.client.google_ads_customer_id && !dec.googleExists) ||
      (dec.metaExists && dec.metaSpend === 0 && dec.metaImpressions === 0) ||
      (dec.googleExists && dec.googleSpend === 0 && dec.googleImpressions === 0)
    );
  });
  
  if (dec2024Issues.length > 0) {
    console.log(`\n🚨 DECEMBER 2024 SPECIFIC ISSUES:`);
    console.log(`   ${dec2024Issues.length} client(s) have missing or zero data for December 2024:`);
    dec2024Issues.forEach(r => {
      console.log(`   - ${r.client.name}`);
    });
  } else {
    console.log(`\n✅ December 2024: No issues found`);
  }
  
  console.log(`\n📄 Reports saved to:`);
  console.log(`   - ${csvFilename}`);
  console.log(`   - ${mdFilename}`);
  console.log();
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

