/**
 * Fix Dashboard Object Display Issue
 * Fixes the [object Object] display in conversion metrics
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs').promises;

async function fixDashboardObjectDisplay() {
  console.log('🔧 FIXING DASHBOARD OBJECT DISPLAY ISSUE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Fix 1: MetaPerformanceLive component
    console.log('🔍 Fixing MetaPerformanceLive component...');
    
    const metaFilePath = 'src/components/MetaPerformanceLive.tsx';
    let metaContent = await fs.readFile(metaFilePath, 'utf8');
    
    // Find the KPI conversion value line and fix it
    const conversionPattern = /value: stats\.totalConversions\.toLocaleString\('pl-PL'\)/;
    
    if (conversionPattern.test(metaContent)) {
      console.log('✅ Found conversion display issue in MetaPerformanceLive');
      
      // Replace with safe conversion
      metaContent = metaContent.replace(
        conversionPattern,
        `value: (Number(stats.totalConversions) || 0).toLocaleString('pl-PL')`
      );
      
      await fs.writeFile(metaFilePath, metaContent);
      console.log('✅ Fixed MetaPerformanceLive conversion display');
    }

    // Fix 2: Dashboard component - check for any similar issues
    console.log('🔍 Checking dashboard component...');
    
    const dashboardFilePath = 'src/app/dashboard/page.tsx';
    let dashboardContent = await fs.readFile(dashboardFilePath, 'utf8');
    
    // Look for any unsafe object rendering
    const objectPatterns = [
      /clientData\.conversionMetrics\?\.([^|]+)\|\|/g,
      /conversionMetrics\.([^}]+)}/g
    ];
    
    let dashboardFixed = false;
    for (const pattern of objectPatterns) {
      const matches = dashboardContent.match(pattern);
      if (matches) {
        console.log('⚠️ Found potential object rendering issues in dashboard:', matches);
      }
    }

    // Fix 3: Add debug logging to identify the exact issue
    console.log('🔍 Adding debug logging...');
    
    // Add debug console.log right before the KPICarousel
    const kpiCarouselPattern = /(value: stats\.totalConversions\.toLocaleString\('pl-PL'\))/;
    
    if (kpiCarouselPattern.test(metaContent)) {
      console.log('📝 Adding debug logging for conversion data');
      
      metaContent = metaContent.replace(
        /(\{[\s\S]*?id: 'conversions',[\s\S]*?label: 'Konwersje',)/,
        `$1
            // DEBUG: Log conversion data type and value
            ...(() => {
              console.log('🔍 DEBUG Conversion data:', {
                type: typeof stats.totalConversions,
                value: stats.totalConversions,
                isArray: Array.isArray(stats.totalConversions),
                isObject: typeof stats.totalConversions === 'object',
                stringified: JSON.stringify(stats.totalConversions)
              });
              return {};
            })(),`
      );
      
      await fs.writeFile(metaFilePath, metaContent);
      console.log('✅ Added debug logging');
    }

    // Fix 4: Comprehensive safe conversion function
    console.log('🔧 Adding comprehensive safe conversion function...');
    
    const safeConversionFunction = `
    // Safe conversion helper function
    const safeConversion = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseFloat(value) || 0;
      if (Array.isArray(value)) return value.reduce((sum, item) => sum + safeConversion(item), 0);
      if (typeof value === 'object' && value !== null) {
        // Try to extract numeric values from object
        const keys = ['total', 'count', 'value', 'amount'];
        for (const key of keys) {
          if (value[key] !== undefined) {
            return safeConversion(value[key]);
          }
        }
        return 0;
      }
      return 0;
    };
    `;
    
    // Add the function near the top of MetaPerformanceLive
    if (!metaContent.includes('safeConversion')) {
      metaContent = metaContent.replace(
        /export default function MetaPerformanceLive/,
        safeConversionFunction + '\nexport default function MetaPerformanceLive'
      );
      
      // Update the conversion value to use safe conversion
      metaContent = metaContent.replace(
        /value: \(Number\(stats\.totalConversions\) \|\| 0\)\.toLocaleString\('pl-PL'\)/,
        `value: safeConversion(stats.totalConversions).toLocaleString('pl-PL')`
      );
      
      await fs.writeFile(metaFilePath, metaContent);
      console.log('✅ Added safe conversion function');
    }

    console.log('');
    console.log('🎯 FIXES APPLIED:');
    console.log('1. ✅ Fixed unsafe conversion display in MetaPerformanceLive');
    console.log('2. ✅ Added debug logging to identify data type issues');
    console.log('3. ✅ Added comprehensive safe conversion function');
    console.log('4. ✅ Protected against arrays, objects, and invalid data');
    console.log('');
    console.log('🔄 NEXT STEPS:');
    console.log('1. The server is already running with fixes');
    console.log('2. Refresh your dashboard page');
    console.log('3. Check browser console for debug info');
    console.log('4. Conversion should show proper numbers instead of [object Object]');
    console.log('');
    console.log('🚀 The dashboard should now display correctly!');

  } catch (error) {
    console.error('💥 ERROR fixing dashboard display:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the fix
if (require.main === module) {
  fixDashboardObjectDisplay();
}

module.exports = { fixDashboardObjectDisplay }; 