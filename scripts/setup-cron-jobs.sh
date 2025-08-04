#!/bin/bash

# Smart Data Loading - Cron Jobs Setup
# This script sets up automated background collection using cron jobs

echo "🚀 Setting up cron jobs for smart data loading..."

# Configuration - UPDATE THESE VALUES
DOMAIN="your-domain.com"  # Replace with your actual domain
ADMIN_TOKEN="your-admin-token"  # Replace with actual admin JWT token
LOG_FILE="/var/log/smart-data-collection.log"

# Create log file if it doesn't exist
touch $LOG_FILE
chmod 644 $LOG_FILE

echo "📝 Log file: $LOG_FILE"

# Create cron job entries
echo "📅 Setting up cron jobs..."

# Monthly collection - every Sunday at 23:59
MONTHLY_CRON="59 23 * * 0 curl -X POST https://$DOMAIN/api/background/collect-monthly -H \"Authorization: Bearer $ADMIN_TOKEN\" -H \"Content-Type: application/json\" >> $LOG_FILE 2>&1"

# Weekly collection - daily at 00:01
WEEKLY_CRON="1 0 * * * curl -X POST https://$DOMAIN/api/background/collect-weekly -H \"Authorization: Bearer $ADMIN_TOKEN\" -H \"Content-Type: application/json\" >> $LOG_FILE 2>&1"

# Cleanup old data - every Saturday at 02:00
CLEANUP_CRON="0 2 * * 6 curl -X POST https://$DOMAIN/api/background/cleanup-old-data -H \"Authorization: Bearer $ADMIN_TOKEN\" -H \"Content-Type: application/json\" >> $LOG_FILE 2>&1"

# Add to crontab
echo "Adding monthly collection (Sunday 23:59)..."
(crontab -l 2>/dev/null; echo "$MONTHLY_CRON") | crontab -

echo "Adding weekly collection (Daily 00:01)..."
(crontab -l 2>/dev/null; echo "$WEEKLY_CRON") | crontab -

echo "Adding cleanup job (Saturday 02:00)..."
(crontab -l 2>/dev/null; echo "$CLEANUP_CRON") | crontab -

echo "✅ Cron jobs added successfully!"

# Display current crontab
echo ""
echo "📋 Current crontab:"
crontab -l

echo ""
echo "🎉 Cron jobs setup complete!"
echo ""
echo "📅 Schedule:"
echo "  - Monthly collection: Sunday 23:59"
echo "  - Weekly collection: Daily 00:01"
echo "  - Cleanup: Saturday 02:00"
echo "  - Log file: $LOG_FILE"
echo ""
echo "🔧 Next steps:"
echo "  1. Replace 'your-domain.com' with your actual domain"
echo "  2. Replace 'your-admin-token' with actual admin JWT token"
echo "  3. Test the endpoints manually first"
echo "  4. Monitor logs: tail -f $LOG_FILE"
echo ""
echo "🧪 Test commands:"
echo "  # Test monthly collection"
echo "  curl -X POST https://$DOMAIN/api/background/collect-monthly \\"
echo "    -H \"Authorization: Bearer $ADMIN_TOKEN\" \\"
echo "    -H \"Content-Type: application/json\""
echo ""
echo "  # Monitor logs"
echo "  tail -f $LOG_FILE"
echo ""
echo "  # Check cron job status"
echo "  crontab -l" 