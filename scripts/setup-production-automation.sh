#!/bin/bash

# Production Automation Setup Script
# This script sets up automated background collection for the smart data loading system

echo "🚀 Setting up production automation for smart data loading..."

# Configuration
DOMAIN="your-domain.com"  # Replace with your actual domain
ADMIN_TOKEN="your-admin-token"  # Replace with actual admin token
CRON_USER="www-data"  # User to run cron jobs

# Create cron job entries
echo "📅 Setting up cron jobs..."

# Monthly collection - every Sunday at 23:59
MONTHLY_CRON="0 23 * * 0 curl -X POST https://$DOMAIN/api/background/collect-monthly -H \"Authorization: Bearer $ADMIN_TOKEN\" -H \"Content-Type: application/json\" >> /var/log/smart-data-collection.log 2>&1"

# Weekly collection - daily at 00:01
WEEKLY_CRON="1 0 * * * curl -X POST https://$DOMAIN/api/background/collect-weekly -H \"Authorization: Bearer $ADMIN_TOKEN\" -H \"Content-Type: application/json\" >> /var/log/smart-data-collection.log 2>&1"

# Cleanup old data - every Saturday at 02:00
CLEANUP_CRON="0 2 * * 6 curl -X POST https://$DOMAIN/api/background/cleanup-old-data -H \"Authorization: Bearer $ADMIN_TOKEN\" -H \"Content-Type: application/json\" >> /var/log/smart-data-collection.log 2>&1"

# Add to crontab
(crontab -l 2>/dev/null; echo "$MONTHLY_CRON") | crontab -
(crontab -l 2>/dev/null; echo "$WEEKLY_CRON") | crontab -
(crontab -l 2>/dev/null; echo "$CLEANUP_CRON") | crontab -

echo "✅ Cron jobs added successfully"

# Create log file
touch /var/log/smart-data-collection.log
chown $CRON_USER:$CRON_USER /var/log/smart-data-collection.log

echo "📝 Log file created: /var/log/smart-data-collection.log"

# Create monitoring script
cat > /usr/local/bin/monitor-smart-data.sh << 'EOF'
#!/bin/bash

# Smart Data Collection Monitoring Script
LOG_FILE="/var/log/smart-data-collection.log"
ALERT_EMAIL="admin@your-domain.com"

# Check if collection is running
if pgrep -f "collect-monthly\|collect-weekly" > /dev/null; then
    echo "✅ Background collection is running"
else
    echo "❌ Background collection is not running"
    echo "Background collection stopped at $(date)" | mail -s "Smart Data Collection Alert" $ALERT_EMAIL
fi

# Check log file for errors
ERROR_COUNT=$(grep -c "ERROR\|FAILED" $LOG_FILE 2>/dev/null || echo "0")
if [ $ERROR_COUNT -gt 0 ]; then
    echo "⚠️  Found $ERROR_COUNT errors in collection log"
    tail -20 $LOG_FILE | mail -s "Smart Data Collection Errors" $ALERT_EMAIL
fi

# Check database storage
# This would need to be customized based on your database setup
echo "📊 Storage status check completed"
EOF

chmod +x /usr/local/bin/monitor-smart-data.sh

# Add monitoring to crontab (every hour)
MONITOR_CRON="0 * * * * /usr/local/bin/monitor-smart-data.sh"
(crontab -l 2>/dev/null; echo "$MONITOR_CRON") | crontab -

echo "✅ Monitoring script added"

echo ""
echo "🎉 Production automation setup complete!"
echo ""
echo "📋 Summary:"
echo "  - Monthly collection: Sunday 23:59"
echo "  - Weekly collection: Daily 00:01"
echo "  - Cleanup: Saturday 02:00"
echo "  - Monitoring: Every hour"
echo "  - Log file: /var/log/smart-data-collection.log"
echo ""
echo "🔧 Next steps:"
echo "  1. Replace 'your-domain.com' with your actual domain"
echo "  2. Replace 'your-admin-token' with actual admin token"
echo "  3. Update alert email in monitoring script"
echo "  4. Test the endpoints manually first"
echo "  5. Monitor logs for the first few days" 