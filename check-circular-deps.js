const fs = require('fs');
const path = require('path');

function findImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];
    
    // Find ES6 imports
    const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        imports.push(importPath);
      }
    }
    
    return imports;
  } catch (error) {
    return [];
  }
}

function checkCircularDeps() {
  console.log('🔍 CHECKING FOR CIRCULAR DEPENDENCIES...\n');
  
  const criticalFiles = [
    'src/lib/supabase.ts',
    'src/lib/supabase-admin.ts', 
    'src/lib/auth.ts',
    'src/lib/logger.ts',
    'src/lib/database.types.ts',
    'src/components/AuthProvider.tsx',
    'src/app/layout.tsx'
  ];
  
  const dependencyMap = {};
  
  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      const imports = findImports(file);
      dependencyMap[file] = imports;
      console.log(`📄 ${file}:`);
      if (imports.length === 0) {
        console.log('   ✅ No local imports');
      } else {
        imports.forEach(imp => console.log(`   📦 imports: ${imp}`));
      }
      console.log('');
    } else {
      console.log(`❌ ${file}: FILE NOT FOUND\n`);
    }
  }
  
  // Simple circular dependency detection
  console.log('🔄 CHECKING FOR OBVIOUS CIRCULAR DEPENDENCIES:');
  let foundCircular = false;
  
  for (const [file, imports] of Object.entries(dependencyMap)) {
    for (const importPath of imports) {
      // Convert relative path to absolute for comparison
      const resolvedPath = path.resolve(path.dirname(file), importPath);
      const normalizedPath = resolvedPath.replace(/\.(ts|tsx|js|jsx)$/, '');
      
      // Check if any file imports back to this one
      for (const [otherFile, otherImports] of Object.entries(dependencyMap)) {
        if (otherFile !== file) {
          for (const otherImport of otherImports) {
            const otherResolvedPath = path.resolve(path.dirname(otherFile), otherImport);
            const otherNormalizedPath = otherResolvedPath.replace(/\.(ts|tsx|js|jsx)$/, '');
            
            if (normalizedPath.includes(otherFile.replace(/\.(ts|tsx)$/, '')) && 
                otherNormalizedPath.includes(file.replace(/\.(ts|tsx)$/, ''))) {
              console.log(`   ⚠️ POTENTIAL CIRCULAR: ${file} ↔ ${otherFile}`);
              foundCircular = true;
            }
          }
        }
      }
    }
  }
  
  if (!foundCircular) {
    console.log('   ✅ No obvious circular dependencies found');
  }
  
  return dependencyMap;
}

checkCircularDeps();
