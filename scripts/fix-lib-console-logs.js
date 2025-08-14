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
      
      // Determine relative path to logger based on file location
      const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '../src/lib')).replace(/\\/g, '/');
      const loggerImportPath = relativePath + '/logger';
      
      content = content.slice(0, importPosition) + 
                `\nimport logger from '${loggerImportPath}';` + 
                content.slice(importPosition);
      modified = true;
    }
  }

  // Replace console.log patterns (only in non-logger files)
  if (!filePath.includes('logger.ts')) {
    const replacements = [
      // Replace console.log with logger.info by default
      {
        pattern: /console\.log\(/g,
        replacement: "logger.info("
      },
      // Replace console.error with logger.error
      {
        pattern: /console\.error\(/g,
        replacement: "logger.error("
      },
      // Replace console.warn with logger.warn
      {
        pattern: /console\.warn\(/g,
        replacement: "logger.warn("
      }
    ];

    replacements.forEach(({pattern, replacement}) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });
  }

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
      // Skip node_modules and other unwanted directories
      if (!['node_modules', '.git', '.next'].includes(file.name)) {
        processDirectory(fullPath);
      }
    } else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      replaceConsoleLogsInFile(fullPath);
    }
  });
}

// Process lib directory
const libDir = path.join(__dirname, '../src/lib');
console.log('🔄 Replacing console.log statements in lib files...');
processDirectory(libDir);

console.log('✅ Lib console.log replacement completed!'); 