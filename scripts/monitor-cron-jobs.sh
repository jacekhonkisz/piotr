#!/bin/bash

# Smart Data Loading - Cron Jobs Monitoring
# This script monitors the health of background collection jobs

LOG_FILE="/var/log/smart-data-collection.log"
ALERT_EMAIL="admin@your-domain.com"  # Update with your email

echo "🔍 Monitoring smart data loading cron jobs..."
echo "📝 Log file: $LOG_FILE"
echo ""

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    echo "   Run setup-cron-jobs.sh first"
    exit 1
fi

# Check cron jobs
echo "📅 Checking cron jobs..."
CRON_JOBS=$(crontab -l 2>/dev/null | grep -c "collect-monthly\|collect-weekly\|cleanup-old-data")
if [ $CRON_JOBS -eq 0 ]; then
    echo "❌ No cron jobs found"
    echo "   Run setup-cron-jobs.sh to set up automation"
else
    echo "✅ Found $CRON_JOBS cron jobs"
    echo ""
    echo "📋 Current cron jobs:"
    crontab -l | grep "collect-monthly\|collect-weekly\|cleanup-old-data"
fi

echo ""

# Check recent log activity
echo "📊 Checking recent log activity..."
LAST_LOG_ENTRY=$(tail -1 "$LOG_FILE" 2>/dev/null)
if [ -z "$LAST_LOG_ENTRY" ]; then
    echo "⚠️  No log entries found"
    echo "   Jobs may not have run yet or there's an issue"
else
    echo "✅ Last log entry:"
    echo "   $LAST_LOG_ENTRY"
fi

echo ""

# Check for errors in last 24 hours
echo "🚨 Checking for errors in last 24 hours..."
ERROR_COUNT=$(grep -c "ERROR\|FAILED\|Exception" "$LOG_FILE" 2>/dev/null || echo "0")
if [ $ERROR_COUNT -gt 0 ]; then
    echo "❌ Found $ERROR_COUNT errors:"
    grep "ERROR\|FAILED\|Exception" "$LOG_FILE" | tail -5
else
    echo "✅ No errors found in recent logs"
fi

echo ""

# Check for successful runs in last 24 hours
echo "✅ Checking successful runs in last 24 hours..."
SUCCESS_COUNT=$(grep -c "completed\|success" "$LOG_FILE" 2>/dev/null || echo "0")
if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "✅ Found $SUCCESS_COUNT successful runs:"
    grep "completed\|success" "$LOG_FILE" | tail -3
else
    echo "⚠️  No successful runs found in recent logs"
fi

echo ""

# Check log file size
LOG_SIZE=$(du -h "$LOG_FILE" | cut -f1)
echo "📏 Log file size: $LOG_SIZE"

# Check if log file is growing
if [ -f "$LOG_FILE" ]; then
    LOG_LINES=$(wc -l < "$LOG_FILE")
    echo "📊 Total log lines: $LOG_LINES"
fi

echo ""

# Test API endpoints
echo "🧪 Testing API endpoints..."
DOMAIN="your-domain.com"  # Update with your domain
ADMIN_TOKEN="your-admin-token"  # Update with your token

if [ "$DOMAIN" != "your-domain.com" ] && [ "$ADMIN_TOKEN" != "your-admin-token" ]; then
    echo "Testing monthly collection endpoint..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://$DOMAIN/api/background/collect-monthly" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json")
    
    if [ "$RESPONSE" = "200" ]; then
        echo "✅ Monthly collection endpoint: OK"
    else
        echo "❌ Monthly collection endpoint: HTTP $RESPONSE"
    fi
else
    echo "⚠️  Update DOMAIN and ADMIN_TOKEN in script to test endpoints"
fi

echo ""

# Health summary
echo "📋 Health Summary:"
if [ $CRON_JOBS -gt 0 ] && [ $ERROR_COUNT -eq 0 ] && [ $SUCCESS_COUNT -gt 0 ]; then
    echo "🟢 System Status: HEALTHY"
elif [ $CRON_JOBS -gt 0 ] && [ $ERROR_COUNT -eq 0 ]; then
    echo "🟡 System Status: WARNING (No recent successful runs)"
elif [ $CRON_JOBS -eq 0 ]; then
    echo "🔴 System Status: CRITICAL (No cron jobs configured)"
else
    echo "🔴 System Status: CRITICAL (Errors detected)"
fi

echo ""
echo "🔧 Troubleshooting:"
echo "  - Check cron jobs: crontab -l"
echo "  - Monitor logs: tail -f $LOG_FILE"
echo "  - Test manually: scripts/test-smart-loader-direct.js"
echo "  - Check database: scripts/test-database-storage-verification.js"
echo ""
echo "📞 Support:"
echo "  - Log file: $LOG_FILE"
echo "  - Cron jobs: crontab -l"
echo "  - Manual test: node scripts/test-smart-loader-direct.js" 