#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function replaceConsoleLogsInFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Add logger import if not present and console.log exists
  if (content.includes('console.log') && !content.includes("import logger from")) {
    // Find the position after the last import
    const lastImportMatch = content.match(/import[^;]+;/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const importPosition = content.indexOf(lastImport) + lastImport.length;
      content = content.slice(0, importPosition) + 
                "\nimport logger from '../../../lib/logger';" + 
                content.slice(importPosition);
      modified = true;
    }
  }

  // Replace console.log patterns
  const replacements = [
    // Debug/info logs
    {
      pattern: /console\.log\('🔍[^']*',([^)]+)\)/g,
      replacement: "logger.debug('Debug info',$1)"
    },
    {
      pattern: /console\.log\('📊[^']*',([^)]+)\)/g,
      replacement: "logger.info('Data processing',$1)"
    },
    {
      pattern: /console\.log\('✅[^']*',([^)]+)\)/g,
      replacement: "logger.info('Success',$1)"
    },
    {
      pattern: /console\.log\('🚀[^']*',([^)]+)\)/g,
      replacement: "logger.info('Process started',$1)"
    },
    {
      pattern: /console\.log\('⚠️[^']*',([^)]+)\)/g,
      replacement: "logger.warn('Warning',$1)"
    },
    {
      pattern: /console\.log\('❌[^']*',([^)]+)\)/g,
      replacement: "logger.error('Error occurred',$1)"
    },
    // Simple string logs
    {
      pattern: /console\.log\('([^']+)'\)/g,
      replacement: "logger.info('$1')"
    },
    // Generic console.log with objects
    {
      pattern: /console\.log\('([^']+)',([^)]+)\)/g,
      replacement: "logger.info('$1',$2)"
    }
  ];

  replacements.forEach(({pattern, replacement}) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
  } else {
    console.log(`⏭️ No changes: ${filePath}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  files.forEach(file => {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      replaceConsoleLogsInFile(fullPath);
    }
  });
}

// Process API routes
const apiDir = path.join(__dirname, '../src/app/api');
console.log('🔄 Replacing console.log statements in API routes...');
processDirectory(apiDir);

console.log('✅ Console.log replacement completed!'); 