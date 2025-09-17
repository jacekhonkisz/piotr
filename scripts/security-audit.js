const fs = require('fs');
const path = require('path');

// Patterns to look for
const SECURITY_PATTERNS = {
  hardcodedPasswords: [
    /password['"]?\s*[:=]\s*['"]password123['"]/gi,
    /password['"]?\s*[:=]\s*['"]admin123['"]/gi,
    /password['"]?\s*[:=]\s*['"]123456['"]/gi,
    /password['"]?\s*[:=]\s*['"]qwerty['"]/gi,
  ],
  apiKeys: [
    /api_key['"]?\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
    /apiKey['"]?\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
    /access_token['"]?\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
  ],
  databaseUrls: [
    /DATABASE_URL['"]?\s*[:=]\s*['"][^'"]*['"]/gi,
    /SUPABASE_URL['"]?\s*[:=]\s*['"][^'"]*['"]/gi,
  ],
  secrets: [
    /secret['"]?\s*[:=]\s*['"][a-zA-Z0-9]{10,}['"]/gi,
    /SECRET['"]?\s*[:=]\s*['"][a-zA-Z0-9]{10,}['"]/gi,
  ]
};

// Files to exclude
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /.git/,
  /dist/,
  /build/,
  /.next/,
  /coverage/,
  /\.env/,
  /package-lock\.json/,
  /yarn\.lock/,
  /\.log$/,
  /\.md$/,
  /\.txt$/,
  /\.json$/,
  /\.lock$/
];

// Extensions to include
const INCLUDE_EXTENSIONS = [
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.vue',
  '.py',
  '.php',
  '.rb',
  '.java',
  '.cs',
  '.go',
  '.rs'
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function shouldIncludeFile(filePath) {
  const ext = path.extname(filePath);
  return INCLUDE_EXTENSIONS.includes(ext);
}

function scanFile(filePath) {
  const issues = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    Object.entries(SECURITY_PATTERNS).forEach(([issueType, patterns]) => {
      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const lineNumber = lines.findIndex(line => line.includes(match)) + 1;
            issues.push({
              type: issueType,
              file: filePath,
              line: lineNumber,
              match: match.trim(),
              severity: issueType === 'hardcodedPasswords' ? 'CRITICAL' : 'HIGH'
            });
          });
        }
      });
    });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
  }
  
  return issues;
}

function scanDirectory(dirPath, allIssues = []) {
  try {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldExcludeFile(fullPath)) {
          scanDirectory(fullPath, allIssues);
        }
      } else if (stat.isFile()) {
        if (shouldIncludeFile(fullPath) && !shouldExcludeFile(fullPath)) {
          const issues = scanFile(fullPath);
          allIssues.push(...issues);
        }
      }
    });
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
  }
  
  return allIssues;
}

function generateReport(issues) {
  console.log('🔍 Security Audit Report');
  console.log('=' .repeat(50));
  console.log(`\n📊 Summary:`);
  console.log(`Total Issues Found: ${issues.length}`);
  
  const byType = {};
  const bySeverity = {};
  
  issues.forEach(issue => {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  });
  
  console.log('\n📈 By Issue Type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\n🚨 By Severity:');
  Object.entries(bySeverity).forEach(([severity, count]) => {
    console.log(`  ${severity}: ${count}`);
  });
  
  console.log('\n🔍 Detailed Issues:');
  console.log('=' .repeat(50));
  
  // Group by severity
  const criticalIssues = issues.filter(i => i.severity === 'CRITICAL');
  const highIssues = issues.filter(i => i.severity === 'HIGH');
  const mediumIssues = issues.filter(i => i.severity === 'MEDIUM');
  
  if (criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    criticalIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.match}`);
    });
  }
  
  if (highIssues.length > 0) {
    console.log('\n⚠️  HIGH PRIORITY ISSUES:');
    highIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.match}`);
    });
  }
  
  if (mediumIssues.length > 0) {
    console.log('\n📝 MEDIUM PRIORITY ISSUES:');
    mediumIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.match}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('=' .repeat(50));
  
  if (criticalIssues.length > 0) {
    console.log('\n🚨 IMMEDIATE ACTIONS REQUIRED:');
    console.log('  1. Remove all hardcoded passwords');
    console.log('  2. Use environment variables for sensitive data');
    console.log('  3. Update scripts to use secure password manager');
    console.log('  4. Review and fix all CRITICAL issues before deployment');
  }
  
  if (highIssues.length > 0) {
    console.log('\n⚠️  HIGH PRIORITY ACTIONS:');
    console.log('  1. Move API keys to environment variables');
    console.log('  2. Remove database URLs from code');
    console.log('  3. Use secure secret management');
  }
  
  console.log('\n🔒 Security Best Practices:');
  console.log('  1. Never commit passwords to version control');
  console.log('  2. Use environment variables for all sensitive data');
  console.log('  3. Implement proper secret management');
  console.log('  4. Regular security audits');
  console.log('  5. Use the secure password manager for all operations');
  
  return {
    totalIssues: issues.length,
    criticalIssues: criticalIssues.length,
    highIssues: highIssues.length,
    mediumIssues: mediumIssues.length,
    issues
  };
}

function main() {
  const startDir = process.argv[2] || '.';
  
  console.log('🔍 Starting Security Audit...');
  console.log(`📁 Scanning directory: ${startDir}`);
  console.log('');
  
  const issues = scanDirectory(startDir);
  const report = generateReport(issues);
  
  // Exit with error code if critical issues found
  if (report.criticalIssues > 0) {
    console.log('\n❌ CRITICAL SECURITY ISSUES FOUND!');
    console.log('   Please fix these issues before deployment.');
    process.exit(1);
  }
  
  if (report.highIssues > 0) {
    console.log('\n⚠️  HIGH PRIORITY ISSUES FOUND!');
    console.log('   Please review and fix these issues.');
    process.exit(1);
  }
  
  console.log('\n✅ No critical security issues found!');
  console.log('   Code appears to be secure for deployment.');
}

if (require.main === module) {
  main();
}

module.exports = {
  scanDirectory,
  scanFile,
  generateReport
}; 