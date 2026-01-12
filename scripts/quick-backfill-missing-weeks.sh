#!/bin/bash

# Quick script to backfill missing Google Ads weeks
# This runs the TypeScript backfill script

echo "🔄 Starting Google Ads weeks backfill..."
echo ""

# Run the backfill script
npx tsx scripts/backfill-all-missing-google-ads-weeks.ts

echo ""
echo "✅ Backfill complete!"
echo ""
echo "💡 To verify, run:"
echo "   npx tsx scripts/monitor-google-ads-weekly-collection.ts"

