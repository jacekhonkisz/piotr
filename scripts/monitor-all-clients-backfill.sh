#!/bin/bash
# Monitor the backfill progress for all clients

echo "📊 Monitoring Google Ads Backfill Progress (All Clients)"
echo "=========================================================="
echo ""

# Check if log file exists
if [ ! -f "backfill-all-clients-conversion-values.log" ]; then
    echo "⚠️  Log file not found. The backfill may not have started yet."
    exit 1
fi

# Show last 30 lines
echo "📋 Last 30 lines of backfill log:"
echo "-----------------------------------"
tail -n 30 backfill-all-clients-conversion-values.log

echo ""
echo "📊 Summary:"
echo "-----------------------------------"
echo "✅ Successes: $(grep -c "✅ Stored:" backfill-all-clients-conversion-values.log 2>/dev/null || echo 0)"
echo "❌ Errors: $(grep -c "❌" backfill-all-clients-conversion-values.log 2>/dev/null || echo 0)"
echo "🔄 Re-collecting: $(grep -c "🔄 Force re-collecting" backfill-all-clients-conversion-values.log 2>/dev/null || echo 0)"
echo ""

# Show current client being processed
CURRENT_CLIENT=$(tail -n 50 backfill-all-clients-conversion-values.log | grep -E "Processing client|Client:" | tail -n 1)
if [ ! -z "$CURRENT_CLIENT" ]; then
    echo "🔄 Currently processing:"
    echo "$CURRENT_CLIENT"
    echo ""
fi

# Show last completed period
LAST_COMPLETED=$(tail -n 50 backfill-all-clients-conversion-values.log | grep "✅ Stored:" | tail -n 1)
if [ ! -z "$LAST_COMPLETED" ]; then
    echo "✅ Last completed:"
    echo "$LAST_COMPLETED"
    echo ""
fi

echo "💡 To see full log: tail -f backfill-all-clients-conversion-values.log"

