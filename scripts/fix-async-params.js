/**
 * Fix Async Params Issues - Next.js 15+ requires params to be awaited
 */

const fs = require('fs').promises;
const path = require('path');

async function fixAsyncParams() {
  console.log('🔧 FIXING ASYNC PARAMS ISSUES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const filesToFix = [
    'src/app/api/clients/[id]/notes/route.ts',
    'src/app/api/clients/[id]/update-email/route.ts', 
    'src/app/api/clients/[id]/route.ts',
    'src/app/api/clients/[id]/refresh-token/route.ts',
    'src/app/api/clients/[id]/regenerate-password/route.ts',
    'src/app/api/clients/[id]/upload-logo/route.ts',
    'src/app/api/sent-reports/[id]/preview/route.ts',
    'src/app/api/sent-reports/[id]/resend/route.ts',
    'src/app/api/sent-reports/[id]/download/route.ts'
  ];

  const fixes = [];

  for (const filePath of filesToFix) {
    try {
      console.log(`🔍 Processing: ${filePath}`);
      
      let content = await fs.readFile(filePath, 'utf8');
      let modified = false;

      // Fix function signatures
      const oldSignature = /{ params }: { params: { id: string } }/g;
      const newSignature = '{ params }: { params: Promise<{ id: string }> }';
      
      if (content.includes('{ params }: { params: { id: string } }')) {
        content = content.replace(oldSignature, newSignature);
        modified = true;
        console.log(`  ✅ Fixed function signature(s)`);
      }

      // Add await params at the beginning of functions that use params
      if (content.includes('params.id') && !content.includes('const { id } = await params;')) {
        // Find function bodies and add await params
        const functionPattern = /(\) {\s*try {\s*)/g;
        content = content.replace(functionPattern, (match) => {
          return match + '\n    // Await params before using\n    const { id } = await params;\n    ';
        });
        modified = true;
        console.log(`  ✅ Added params await`);
      }

      // Replace all instances of params.id with id
      if (content.includes('params.id')) {
        content = content.replace(/params\.id/g, 'id');
        modified = true;
        console.log(`  ✅ Replaced params.id with id`);
      }

      if (modified) {
        await fs.writeFile(filePath, content);
        fixes.push(filePath);
        console.log(`  💾 Saved changes to ${filePath}`);
      } else {
        console.log(`  ⚪ No changes needed for ${filePath}`);
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${filePath}:`, error.message);
    }
  }

  console.log('\n✅ ASYNC PARAMS FIXES COMPLETED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (fixes.length > 0) {
    console.log('🎯 Fixed files:');
    fixes.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });
  } else {
    console.log('⚠️ No files needed fixing');
  }

  console.log('\n📋 WHAT WAS FIXED:');
  console.log('1. ✅ Updated function signatures to Promise<{ id: string }>');
  console.log('2. ✅ Added await params before using params.id');
  console.log('3. ✅ Replaced all params.id with destructured id');
  console.log('4. ✅ Fixed Next.js 15+ async params compatibility');

  console.log('\n🔄 NEXT STEPS:');
  console.log('1. Restart your development server');
  console.log('2. The async params errors should be resolved');
  console.log('3. API routes should work normally again');
}

// Run the fixes
if (require.main === module) {
  fixAsyncParams();
}

module.exports = { fixAsyncParams }; 