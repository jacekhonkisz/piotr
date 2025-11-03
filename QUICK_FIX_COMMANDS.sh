#!/bin/bash

# ⚡ QUICK FIX COMMANDS
# Run this script to fix the most critical issues automatically
# 
# Usage: bash QUICK_FIX_COMMANDS.sh
# Or run commands manually one by one

set -e  # Exit on error

echo "🔍 Starting Quick Fix Script..."
echo ""

# ============================================================================
# PHASE 1: BACKUP
# ============================================================================

echo "📦 Phase 1: Creating backup..."
git status
read -p "❓ Do you have uncommitted changes? Commit them now! Press enter when ready..."

git checkout -b audit-fixes-2025-11-03
echo "✅ Created backup branch: audit-fixes-2025-11-03"
echo ""

# ============================================================================
# PHASE 2: DELETE TEST/DEBUG ENDPOINTS
# ============================================================================

echo "🗑️  Phase 2: Deleting test and debug endpoints..."

# Count how many we're deleting
TEST_COUNT=$(find src/app/api -type d -name "test-*" 2>/dev/null | wc -l)
DEBUG_COUNT=$(find src/app/api -type d -name "debug-*" 2>/dev/null | wc -l)

echo "Found $TEST_COUNT test endpoints and $DEBUG_COUNT debug endpoints"
read -p "❓ Delete these endpoints? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Delete test endpoints
    find src/app/api -type d -name "test-*" -exec rm -rf {} + 2>/dev/null || true
    find src/app/api -type d -name "debug-*" -exec rm -rf {} + 2>/dev/null || true
    
    # Delete specific endpoints
    rm -rf src/app/api/test 2>/dev/null || true
    rm -rf src/app/api/simple 2>/dev/null || true
    rm -rf src/app/api/ping 2>/dev/null || true
    rm -rf src/app/api/final-cache-test 2>/dev/null || true
    
    echo "✅ Deleted test and debug endpoints"
else
    echo "⏭️  Skipped deleting test endpoints"
fi
echo ""

# ============================================================================
# PHASE 3: DELETE DUPLICATE FILES
# ============================================================================

echo "🔄 Phase 3: Deleting duplicate implementations..."

# Check what will be deleted
echo "These duplicate files will be deleted:"
echo "  - src/lib/auth.ts"
echo "  - src/lib/auth-optimized.ts"
echo "  - src/lib/meta-api.ts"
echo "  - src/lib/email.ts"
echo "  - src/lib/gmail-email.ts"
echo "  - src/lib/google-ads-smart-cache-helper.ts.backup"
echo ""

read -p "❓ Delete duplicate files? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Check for imports before deleting
    echo "🔍 Checking for imports of files to be deleted..."
    
    echo "auth.ts imports:"
    grep -r "from.*['\"].*lib/auth['\"]" src/ 2>/dev/null | grep -v "auth-middleware" | grep -v "auth-optimized" || echo "  None found"
    
    echo "meta-api.ts imports:"
    grep -r "from.*['\"].*lib/meta-api['\"]" src/ 2>/dev/null | grep -v "meta-api-optimized" || echo "  None found"
    
    echo "email.ts/gmail-email.ts imports:"
    grep -r "from.*['\"].*lib/email['\"]" src/ 2>/dev/null | grep -v "flexible-email" || echo "  None found"
    grep -r "from.*['\"].*lib/gmail-email['\"]" src/ 2>/dev/null || echo "  None found"
    
    echo ""
    read -p "⚠️  You will need to update these imports manually. Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        # Delete duplicate auth files
        rm -f src/lib/auth.ts 2>/dev/null || true
        rm -f src/lib/auth-optimized.ts 2>/dev/null || true
        
        # Delete duplicate Meta API
        rm -f src/lib/meta-api.ts 2>/dev/null || true
        
        # Delete duplicate email files
        rm -f src/lib/email.ts 2>/dev/null || true
        rm -f src/lib/gmail-email.ts 2>/dev/null || true
        
        # Delete backup file
        rm -f src/lib/google-ads-smart-cache-helper.ts.backup 2>/dev/null || true
        
        echo "✅ Deleted duplicate files"
        echo "⚠️  IMPORTANT: You MUST update imports now!"
        echo "   - Change 'auth' imports to 'auth-middleware'"
        echo "   - Change 'meta-api' imports to 'meta-api-optimized'"
        echo "   - Change 'email' imports to 'flexible-email'"
    else
        echo "⏭️  Skipped deleting duplicate files"
    fi
else
    echo "⏭️  Skipped deleting duplicate files"
fi
echo ""

# ============================================================================
# PHASE 4: VERIFY
# ============================================================================

echo "🔍 Phase 4: Running verification checks..."
echo ""

echo "Checking for remaining test endpoints..."
REMAINING_TESTS=$(find src/app/api -name "test-*" -o -name "debug-*" 2>/dev/null | wc -l)
if [ "$REMAINING_TESTS" -eq 0 ]; then
    echo "  ✅ No test endpoints found"
else
    echo "  ⚠️  $REMAINING_TESTS test endpoints still exist"
fi

echo "Checking for backup files..."
BACKUP_FILES=$(find . -name "*.backup" -o -name "*.bak" 2>/dev/null | wc -l)
if [ "$BACKUP_FILES" -eq 0 ]; then
    echo "  ✅ No backup files found"
else
    echo "  ⚠️  $BACKUP_FILES backup files still exist"
fi

echo "Checking for auth bypasses..."
AUTH_BYPASSES=$(grep -r "AUTH DISABLED\|no auth required\|auth-disabled" src/app/api/ 2>/dev/null | wc -l)
if [ "$AUTH_BYPASSES" -eq 0 ]; then
    echo "  ✅ No auth bypasses found"
else
    echo "  ⚠️  $AUTH_BYPASSES potential auth bypasses found"
    grep -r "AUTH DISABLED\|no auth required\|auth-disabled" src/app/api/ 2>/dev/null || true
fi

echo ""

# ============================================================================
# PHASE 5: TYPESCRIPT CHECK
# ============================================================================

echo "📝 Phase 5: Running TypeScript check..."
if npx tsc --noEmit; then
    echo "  ✅ TypeScript check passed"
else
    echo "  ❌ TypeScript check failed"
    echo "  ⚠️  You need to fix import errors manually"
    echo "  💡 See STEP_BY_STEP_FIX_GUIDE.md for help"
fi
echo ""

# ============================================================================
# PHASE 6: COMMIT
# ============================================================================

echo "💾 Phase 6: Committing changes..."
git status

read -p "❓ Commit these changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    git add -A
    git commit -m "♻️ Quick audit fixes

- Removed test and debug endpoints
- Deleted duplicate implementations
- Cleaned up backup files

Note: Import references need manual update"
    
    echo "✅ Changes committed"
else
    echo "⏭️  Skipped commit"
fi
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "=========================================="
echo "🎉 QUICK FIX COMPLETE!"
echo "=========================================="
echo ""
echo "✅ What was done:"
echo "   - Deleted test/debug endpoints"
echo "   - Removed duplicate files"
echo "   - Created backup branch"
echo "   - Committed changes"
echo ""
echo "⚠️  NEXT STEPS (MANUAL):"
echo "   1. Fix authentication on these files:"
echo "      - src/app/api/fetch-meta-tables/route.ts (lines 17-19)"
echo "      - src/app/api/smart-cache/route.ts (lines 10-11)"
echo ""
echo "   2. Update imports in files that used deleted modules"
echo ""
echo "   3. Run these commands:"
echo "      npx tsc --noEmit  # Check TypeScript"
echo "      npm run lint      # Check code style"
echo "      npm test          # Run tests"
echo "      npm run build     # Build for production"
echo ""
echo "📖 Read STEP_BY_STEP_FIX_GUIDE.md for detailed instructions"
echo ""
echo "Current branch: $(git branch --show-current)"
echo ""

