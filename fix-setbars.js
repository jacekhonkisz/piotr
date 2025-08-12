const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/components/MetaPerformanceLive.tsx', 'utf8');

// Replace all setBars calls with comments
content = content.replace(/setBars\(\[\]\);.*$/gm, '// Old setBars removed');
content = content.replace(/setBars\(\[.*\]\);.*$/gm, '// Old setBars removed');

// Write back
fs.writeFileSync('src/components/MetaPerformanceLive.tsx', content);
console.log('✅ Fixed all setBars calls');
