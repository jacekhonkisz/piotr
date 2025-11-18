#!/bin/bash

# =====================================================
# APPLY ACTIVE CLIENTS MIGRATION
# =====================================================
# This script applies the migration to ensure all clients are active
# =====================================================

set -e

echo "🚀 Applying 'Set All Clients Active' migration..."
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Attempting direct SQL execution..."
    echo ""
    
    # Read the migration file
    MIGRATION_FILE="supabase/migrations/999_set_all_clients_active.sql"
    
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo "❌ Migration file not found: $MIGRATION_FILE"
        exit 1
    fi
    
    echo "📄 Migration file found: $MIGRATION_FILE"
    echo ""
    echo "📝 Please run this migration manually in Supabase Dashboard:"
    echo "   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
    echo "   2. Copy the SQL from: $MIGRATION_FILE"
    echo "   3. Run it in the SQL Editor"
    echo ""
    echo "💡 OR set up Supabase CLI to apply migrations automatically"
    echo ""
    
    exit 0
fi

echo "✅ Supabase CLI found"
echo "📡 Applying migration to remote database..."
echo ""

# Apply the migration
supabase db push

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "🎯 Next step: Run incremental collection"
echo "   node scripts/manual-collect-belmonte.js"
echo ""

