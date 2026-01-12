#!/usr/bin/env tsx
/**
 * Audit script to verify all conversion_value and total_conversion_value fixes are in place
 */

import * as fs from 'fs';
import * as path from 'path';

const filesToCheck = [
  {
    file: 'src/lib/google-ads-standardized-data-fetcher.ts',
    description: 'Google Ads Standardized Data Fetcher (database summaries)',
    expectedFields: ['conversion_value', 'total_conversion_value']
  },
  {
    file: 'src/lib/standardized-data-fetcher.ts',
    description: 'Standardized Data Fetcher (Meta + Google fallback)',
    expectedFields: ['conversion_value', 'total_conversion_value']
  },
  {
    file: 'src/app/api/fetch-google-ads-live-data/route.ts',
    description: 'Google Ads Live Data API Route',
    expectedFields: ['conversion_value', 'total_conversion_value']
  }
];

function checkFile(filePath: string, description: string, expectedFields: string[]): {
  file: string;
  description: string;
  status: 'ok' | 'missing' | 'error';
  issues: string[];
} {
  const fullPath = path.join(process.cwd(), filePath);
  const issues: string[] = [];
  
  try {
    if (!fs.existsSync(fullPath)) {
      return {
        file: filePath,
        description,
        status: 'error',
        issues: [`File not found: ${fullPath}`]
      };
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Find all conversionMetrics objects
    const conversionMetricsMatches = content.matchAll(/conversionMetrics\s*=\s*\{[^}]*\}/gs);
    const conversionMetricsArray = Array.from(conversionMetricsMatches);
    
    if (conversionMetricsArray.length === 0) {
      issues.push('No conversionMetrics objects found');
    }
    
    conversionMetricsArray.forEach((match, index) => {
      const metricsBlock = match[0];
      expectedFields.forEach(field => {
        if (!metricsBlock.includes(field)) {
          issues.push(`conversionMetrics block #${index + 1} missing field: ${field}`);
        }
      });
    });
    
    // Also check for interface/type definitions
    const hasInterface = content.includes('conversionMetrics:') || content.includes('conversionMetrics?:');
    if (hasInterface) {
      expectedFields.forEach(field => {
        if (!content.includes(`${field}:`)) {
          issues.push(`Interface/type definition missing field: ${field}`);
        }
      });
    }
    
    return {
      file: filePath,
      description,
      status: issues.length === 0 ? 'ok' : 'missing',
      issues
    };
  } catch (error: any) {
    return {
      file: filePath,
      description,
      status: 'error',
      issues: [`Error reading file: ${error.message}`]
    };
  }
}

function main() {
  console.log('🔍 Auditing conversion_value and total_conversion_value fixes...');
  console.log('='.repeat(80));
  console.log('');
  
  const results = filesToCheck.map(({ file, description, expectedFields }) =>
    checkFile(file, description, expectedFields)
  );
  
  let allOk = true;
  
  results.forEach(result => {
    const statusIcon = result.status === 'ok' ? '✅' : result.status === 'missing' ? '⚠️' : '❌';
    console.log(`${statusIcon} ${result.description}`);
    console.log(`   File: ${result.file}`);
    
    if (result.status === 'ok') {
      console.log(`   Status: All required fields present`);
    } else {
      allOk = false;
      console.log(`   Status: ${result.status.toUpperCase()}`);
      if (result.issues.length > 0) {
        console.log(`   Issues:`);
        result.issues.forEach(issue => {
          console.log(`      - ${issue}`);
        });
      }
    }
    console.log('');
  });
  
  console.log('='.repeat(80));
  if (allOk) {
    console.log('✅ All files have the required conversion_value and total_conversion_value fields!');
  } else {
    console.log('⚠️ Some files are missing required fields. Please review the issues above.');
  }
  console.log('');
  
  // Check for potential conflicts
  console.log('🔍 Checking for potential conflicts...');
  console.log('');
  
  const standardizedFetcher = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/standardized-data-fetcher.ts'),
    'utf-8'
  );
  const googleAdsFetcher = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/google-ads-standardized-data-fetcher.ts'),
    'utf-8'
  );
  
  // Check if both fetchers are used for Google Ads
  const reportsPage = fs.readFileSync(
    path.join(process.cwd(), 'src/app/reports/page.tsx'),
    'utf-8'
  );
  
  const usesGoogleAdsFetcher = reportsPage.includes('GoogleAdsStandardizedDataFetcher');
  const usesStandardizedFetcherForGoogle = reportsPage.includes("platform === 'google'") && 
                                           reportsPage.includes('StandardizedDataFetcher');
  
  console.log(`   Reports page uses GoogleAdsStandardizedDataFetcher: ${usesGoogleAdsFetcher ? '✅' : '❌'}`);
  console.log(`   Reports page uses StandardizedDataFetcher for Google: ${usesStandardizedFetcherForGoogle ? '⚠️ CONFLICT' : '✅'}`);
  
  if (usesStandardizedFetcherForGoogle) {
    console.log('');
    console.log('   ⚠️ WARNING: Reports page might be using StandardizedDataFetcher for Google Ads!');
    console.log('      This could cause conflicts. Google Ads should use GoogleAdsStandardizedDataFetcher.');
  }
  
  console.log('');
}

main();

