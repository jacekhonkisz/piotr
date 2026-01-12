#!/bin/bash
# Quick one-time check of backfill status

echo "📊 Google Ads Backfill Status Check"
echo "===================================="
echo ""

# Run the TypeScript monitor once
npx tsx scripts/monitor-backfill-progress.ts 2>&1 | head -80

