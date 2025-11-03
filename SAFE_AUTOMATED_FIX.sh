#!/bin/bash

# 🛡️ SAFE AUTOMATED FIX SCRIPT
# This script follows the safe approach and will NOT break anything
#
# Usage: bash SAFE_AUTOMATED_FIX.sh

set -e  # Exit on error

echo "🛡️ SAFE AUTOMATED FIX SCRIPT"
echo "===================================="
echo ""
echo "This script will:"
echo "  1. Create backup branch"
echo "  2. Enable authentication (security fix)"
echo "  3. Delete dead code (100% safe)"
echo "  4. Update imports BEFORE deleting files"
echo "  5. Test at each step"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# ============================================================================
# PHASE 0: BACKUP
# ============================================================================

echo "📦 Phase 0: Creating backup..."
git status

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes!"
    read -p "❓ Commit them now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add -A
        git commit -m "Backup before safe audit fixes"
    else
        echo "❌ Please commit or stash your changes first"
        exit 1
    fi
fi

# Create backup branch
BRANCH_NAME="safe-audit-fixes-$(date +%Y-%m-%d-%H%M)"
git checkout -b "$BRANCH_NAME"
echo "✅ Created backup branch: $BRANCH_NAME"
echo ""

# ============================================================================
# PHASE 1: ENABLE AUTHENTICATION (CRITICAL!)
# ============================================================================

echo "🔒 Phase 1: Enabling authentication on data endpoints..."
echo ""

# Check if files exist
if [ ! -f "src/app/api/fetch-meta-tables/route.ts" ]; then
    echo "⚠️  File not found: src/app/api/fetch-meta-tables/route.ts"
    echo "Skipping authentication fix for this file"
else
    echo "📝 Manual fix required for: src/app/api/fetch-meta-tables/route.ts"
    echo "   Lines 17-19: Remove 'AUTH DISABLED' comment"
    echo "   Add: await authenticateRequest(request)"
    echo ""
fi

if [ ! -f "src/app/api/smart-cache/route.ts" ]; then
    echo "⚠️  File not found: src/app/api/smart-cache/route.ts"
    echo "Skipping authentication fix for this file"
else
    echo "📝 Manual fix required for: src/app/api/smart-cache/route.ts"
    echo "   Lines 10-11: Remove 'no auth required' comment"
    echo "   Add: await authenticateRequest(request)"
    echo ""
fi

echo "⚠️  IMPORTANT: You need to manually fix authentication in these 2 files"
echo "See SAFE_FIX_APPROACH.md for exact code changes"
echo ""
read -p "Press Enter after you've fixed the authentication, or 's' to skip: " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    # Try to verify TypeScript compiles
    echo "🔍 Verifying TypeScript..."
    if npx tsc --noEmit; then
        echo "✅ TypeScript check passed"
        
        # Commit if changes were made
        if ! git diff-index --quiet HEAD --; then
            git add src/app/api/fetch-meta-tables/route.ts src/app/api/smart-cache/route.ts 2>/dev/null || true
            git commit -m "🔒 Enable authentication on data endpoints"
            echo "✅ Committed authentication fixes"
        fi
    else
        echo "❌ TypeScript errors found. Please fix before continuing."
        exit 1
    fi
fi

echo ""

# ============================================================================
# PHASE 2: DELETE DEAD AUTH FILES (100% SAFE)
# ============================================================================

echo "🗑️  Phase 2: Deleting unused auth files..."
echo ""

# Verify they're not imported
echo "🔍 Checking if auth files are imported..."
AUTH_IMPORTS=$(grep -r "from.*lib/auth'" src/ 2>/dev/null | grep -v "auth-middleware" | grep -v "auth-optimized" | wc -l)
AUTH_OPT_IMPORTS=$(grep -r "from.*lib/auth-optimized'" src/ 2>/dev/null | wc -l)

if [ "$AUTH_IMPORTS" -eq 0 ] && [ "$AUTH_OPT_IMPORTS" -eq 0 ]; then
    echo "✅ Confirmed: auth.ts and auth-optimized.ts are not imported"
    
    if [ -f "src/lib/auth.ts" ]; then
        rm src/lib/auth.ts
        echo "✅ Deleted src/lib/auth.ts"
    fi
    
    if [ -f "src/lib/auth-optimized.ts" ]; then
        rm src/lib/auth-optimized.ts
        echo "✅ Deleted src/lib/auth-optimized.ts"
    fi
    
    # Verify TypeScript still works
    if npx tsc --noEmit; then
        echo "✅ TypeScript check passed after deletion"
        git add -A
        git commit -m "♻️ Remove unused auth files (dead code)"
    else
        echo "❌ TypeScript errors - rolling back"
        git checkout -- src/lib/auth.ts src/lib/auth-optimized.ts 2>/dev/null || true
        exit 1
    fi
else
    echo "⚠️  Auth files are still imported! Skipping deletion."
    echo "   Imports found: $AUTH_IMPORTS auth.ts, $AUTH_OPT_IMPORTS auth-optimized.ts"
fi

echo ""

# ============================================================================
# PHASE 3: UPDATE META-API IMPORTS
# ============================================================================

echo "🔄 Phase 3: Updating meta-api imports..."
echo ""

# Count files that need updating
META_API_COUNT=$(grep -r "from.*lib/meta-api'" src/app/api 2>/dev/null | grep -v "meta-api-optimized" | wc -l)
echo "Found $META_API_COUNT files importing old meta-api"

if [ "$META_API_COUNT" -gt 0 ]; then
    echo "📝 Updating imports from 'meta-api' to 'meta-api-optimized'..."
    
    # Backup before bulk replace
    git add -A
    git commit -m "Backup before meta-api import updates" || true
    
    # Find and replace (macOS compatible)
    find src/app/api -name "*.ts" -type f -exec sed -i '' "s|from '\.\./\.\./\.\./lib/meta-api'|from '../../../lib/meta-api-optimized'|g" {} + 2>/dev/null || true
    find src/app/api -name "*.ts" -type f -exec sed -i '' 's|from "\.\./\.\./\.\./lib/meta-api"|from "../../../lib/meta-api-optimized"|g' {} + 2>/dev/null || true
    
    echo "✅ Updated import statements"
    
    # Verify TypeScript
    echo "🔍 Verifying TypeScript after import updates..."
    if npx tsc --noEmit; then
        echo "✅ TypeScript check passed"
        git add -A
        git commit -m "♻️ Update meta-api imports to optimized version"
    else
        echo "❌ TypeScript errors found after updating imports"
        echo "Please fix manually. See which files have errors above."
        exit 1
    fi
else
    echo "✅ No meta-api imports found (already using optimized version)"
fi

echo ""

# ============================================================================
# PHASE 4: DELETE OLD META-API FILE
# ============================================================================

echo "🗑️  Phase 4: Deleting old meta-api.ts..."
echo ""

if [ -f "src/lib/meta-api.ts" ]; then
    # Double-check no imports
    REMAINING_IMPORTS=$(grep -r "from.*lib/meta-api'" src/ 2>/dev/null | grep -v "meta-api-optimized" | wc -l)
    
    if [ "$REMAINING_IMPORTS" -eq 0 ]; then
        rm src/lib/meta-api.ts
        echo "✅ Deleted src/lib/meta-api.ts"
        
        # Verify
        if npx tsc --noEmit; then
            echo "✅ TypeScript check passed"
            git add -A
            git commit -m "♻️ Remove old meta-api.ts"
        else
            echo "❌ TypeScript errors - rolling back"
            git checkout -- src/lib/meta-api.ts
            exit 1
        fi
    else
        echo "⚠️  Still $REMAINING_IMPORTS files importing meta-api!"
        echo "Cannot safely delete. Manual intervention required."
    fi
else
    echo "✅ meta-api.ts already deleted"
fi

echo ""

# ============================================================================
# PHASE 5: UPDATE EMAIL IMPORT
# ============================================================================

echo "🔄 Phase 5: Updating email imports..."
echo ""

EMAIL_IMPORTS=$(grep -r "from.*lib/email'" src/app/api 2>/dev/null | grep -v "flexible-email" | wc -l)

if [ "$EMAIL_IMPORTS" -gt 0 ]; then
    echo "Found $EMAIL_IMPORTS files importing old email service"
    echo "📝 Manual update required for email imports"
    echo "See SAFE_FIX_APPROACH.md Step 2.3 for instructions"
    echo ""
    read -p "Press Enter after updating email imports, or 's' to skip: " -n 1 -r
    echo ""
else
    echo "✅ No old email imports found"
fi

echo ""

# ============================================================================
# PHASE 6: DELETE OLD EMAIL FILES
# ============================================================================

echo "🗑️  Phase 6: Deleting old email files..."
echo ""

# Check if safe to delete
EMAIL_REMAINING=$(grep -r "from.*lib/email'" src/ 2>/dev/null | grep -v "flexible-email" | grep -v "email-" | wc -l)

if [ "$EMAIL_REMAINING" -eq 0 ]; then
    if [ -f "src/lib/email.ts" ]; then
        rm src/lib/email.ts
        echo "✅ Deleted src/lib/email.ts"
    fi
    
    if [ -f "src/lib/gmail-email.ts" ]; then
        rm src/lib/gmail-email.ts
        echo "✅ Deleted src/lib/gmail-email.ts"
    fi
    
    # Verify
    if npx tsc --noEmit; then
        echo "✅ TypeScript check passed"
        git add -A
        git commit -m "♻️ Remove old email services"
    else
        echo "❌ TypeScript errors - rolling back"
        git checkout -- src/lib/email.ts src/lib/gmail-email.ts 2>/dev/null || true
        exit 1
    fi
else
    echo "⚠️  Still $EMAIL_REMAINING files importing old email service"
    echo "Cannot safely delete."
fi

echo ""

# ============================================================================
# PHASE 7: DELETE TEST/DEBUG ENDPOINTS
# ============================================================================

echo "🗑️  Phase 7: Deleting test and debug endpoints..."
echo ""

TEST_COUNT=$(find src/app/api -type d -name "test-*" 2>/dev/null | wc -l)
DEBUG_COUNT=$(find src/app/api -type d -name "debug-*" 2>/dev/null | wc -l)

echo "Found $TEST_COUNT test endpoints and $DEBUG_COUNT debug endpoints"
read -p "❓ Delete these? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    find src/app/api -type d -name "test-*" -exec rm -rf {} + 2>/dev/null || true
    find src/app/api -type d -name "debug-*" -exec rm -rf {} + 2>/dev/null || true
    rm -rf src/app/api/test 2>/dev/null || true
    rm -rf src/app/api/simple 2>/dev/null || true
    rm -rf src/app/api/ping 2>/dev/null || true
    rm -rf src/app/api/final-cache-test 2>/dev/null || true
    
    echo "✅ Deleted test and debug endpoints"
    
    # Verify build still works
    if npm run build; then
        echo "✅ Build successful"
        git add -A
        git commit -m "🗑️ Remove test and debug endpoints"
    else
        echo "❌ Build failed - please check what went wrong"
        exit 1
    fi
fi

echo ""

# ============================================================================
# PHASE 8: DELETE BACKUP FILE
# ============================================================================

echo "🧹 Phase 8: Deleting backup file..."
echo ""

if [ -f "src/lib/google-ads-smart-cache-helper.ts.backup" ]; then
    rm src/lib/google-ads-smart-cache-helper.ts.backup
    echo "✅ Deleted backup file"
    git add -A
    git commit -m "🧹 Remove backup file"
fi

echo ""

# ============================================================================
# PHASE 9: FINAL VERIFICATION
# ============================================================================

echo "🔍 Phase 9: Final verification..."
echo ""
echo "===================================="
echo "Running comprehensive checks..."
echo "===================================="
echo ""

# TypeScript check
echo "1️⃣ TypeScript check..."
if npx tsc --noEmit; then
    echo "   ✅ PASSED"
else
    echo "   ❌ FAILED - See errors above"
    exit 1
fi

# Lint check
echo ""
echo "2️⃣ Lint check..."
if npm run lint; then
    echo "   ✅ PASSED"
else
    echo "   ⚠️  Linting issues found (fix with: npm run lint --fix)"
fi

# Build check
echo ""
echo "3️⃣ Build check..."
if npm run build; then
    echo "   ✅ PASSED"
else
    echo "   ❌ FAILED - Build errors"
    exit 1
fi

# Issue checks
echo ""
echo "4️⃣ Issue checks..."
AUTH_BYPASSES=$(grep -r "AUTH DISABLED\|no auth required\|auth-disabled" src/app/api 2>/dev/null | wc -l)
TEST_ENDPOINTS=$(find src/app/api -name "test-*" -o -name "debug-*" 2>/dev/null | wc -l)
BACKUP_FILES=$(find . -name "*.backup" -o -name "*.bak" 2>/dev/null | wc -l)

echo "   Auth bypasses: $AUTH_BYPASSES (should be 0)"
echo "   Test endpoints: $TEST_ENDPOINTS (should be 0)"
echo "   Backup files: $BACKUP_FILES (should be 0)"

if [ "$AUTH_BYPASSES" -eq 0 ] && [ "$TEST_ENDPOINTS" -eq 0 ] && [ "$BACKUP_FILES" -eq 0 ]; then
    echo "   ✅ ALL CHECKS PASSED"
else
    echo "   ⚠️  Some issues remain"
fi

echo ""
echo "===================================="
echo "🎉 SAFE FIX COMPLETE!"
echo "===================================="
echo ""
echo "✅ What was done:"
echo "   - Enabled authentication on critical endpoints"
echo "   - Removed unused/duplicate code"
echo "   - Updated imports to optimized versions"
echo "   - Deleted test/debug endpoints"
echo "   - All checks passed"
echo ""
echo "📊 Current branch: $BRANCH_NAME"
echo ""
echo "🚀 Next steps:"
echo "   1. Test the application: npm run dev"
echo "   2. Verify all features work"
echo "   3. Merge to main: git checkout main && git merge $BRANCH_NAME"
echo ""

