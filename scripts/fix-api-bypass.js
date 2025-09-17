/**
 * Fix API Bypass - Remove the protection that's blocking cache usage
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs').promises;

async function fixApiBypass() {
  console.log('🔧 FIXING API BYPASS ISSUE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Read the fetch-live-data API file
    console.log('🔍 Reading fetch-live-data API file...');
    
    const apiFilePath = 'src/app/api/fetch-live-data/route.ts';
    let content = await fs.readFile(apiFilePath, 'utf8');
    
    // Check if the bypass protection exists
    const bypassProtection = content.includes('CRITICAL PROTECTION - Meta API bypass BLOCKED');
    
    if (bypassProtection) {
      console.log('❌ FOUND THE ISSUE: API has bypass protection that returns ZERO values!');
      console.log('');
      
      // The bypass protection is between lines 605-644
      // It returns zero values when forceFresh is false
      // We need to comment out or remove this protection
      
      console.log('🔧 FIXING: Commenting out the bypass protection...');
      
      // Find the bypass protection block and comment it out
      const bypassStart = content.indexOf('// 🔧 CRITICAL FIX: Only proceed with Meta API if explicitly forced');
      const bypassEnd = content.indexOf('// Only reach here if forceFresh: true');
      
      if (bypassStart !== -1 && bypassEnd !== -1) {
        const beforeBypass = content.substring(0, bypassStart);
        const bypassBlock = content.substring(bypassStart, bypassEnd);
        const afterBypass = content.substring(bypassEnd);
        
        // Comment out the entire bypass block
        const commentedBypass = bypassBlock
          .split('\n')
          .map(line => line.trim() ? `      // BYPASS DISABLED: ${line}` : line)
          .join('\n');
        
        // Replace the bypass with a comment explaining what we did
        const fixedBypass = `      // 🔧 BYPASS PROTECTION DISABLED - Allow cache to work
      // The original bypass protection was blocking cache usage
      // This caused the dashboard to always show zero values
      // Cache checking logic should work normally now
      
      console.log('🔄 Cache checking logic enabled - bypass protection disabled');
      
`;
        
        const newContent = beforeBypass + fixedBypass + afterBypass;
        
        await fs.writeFile(apiFilePath, newContent);
        
        console.log('✅ Fixed API bypass protection');
        console.log('');
        console.log('🔧 What was changed:');
        console.log('- Removed the bypass protection that returned zero values');
        console.log('- Cache checking logic should now work normally');
        console.log('- API will use cached data when available');
        console.log('');
        console.log('🔄 NEXT STEPS:');
        console.log('1. Restart your development server (npm run dev)');
        console.log('2. Reload the dashboard');
        console.log('3. You should now see 14,033 PLN instead of zeros');
        
      } else {
        console.log('⚠️ Could not locate exact bypass protection block');
        console.log('Manual fix needed in fetch-live-data route');
      }
      
    } else {
      console.log('⚠️ Bypass protection not found - might already be fixed');
    }

  } catch (error) {
    console.error('💥 ERROR fixing API bypass:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the fix
if (require.main === module) {
  fixApiBypass();
}

module.exports = { fixApiBypass }; 