#!/bin/bash

# Daily KPI Collection Cron Setup
# This sets up a cron job to run daily at 1 AM

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRON_SCRIPT="$SCRIPT_DIR/daily-kpi-collector.js"

echo "🚀 Setting up Daily KPI Collection Cron Job..."
echo "📂 Project directory: $PROJECT_DIR"
echo "📄 Script location: $CRON_SCRIPT"

# Make the script executable
chmod +x "$CRON_SCRIPT"

# Create the cron job entry
CRON_ENTRY="0 1 * * * cd $PROJECT_DIR && /usr/local/bin/node $CRON_SCRIPT >> $PROJECT_DIR/logs/daily-kpi-collection.log 2>&1"

echo "📅 Cron job entry:"
echo "$CRON_ENTRY"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Add to crontab (avoid duplicates)
echo "🔧 Installing cron job..."
(crontab -l 2>/dev/null | grep -v "daily-kpi-collector.js"; echo "$CRON_ENTRY") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Cron job installed successfully!"
    echo "📊 Daily KPI collection will run every day at 1:00 AM"
    echo "📝 Logs will be written to: $PROJECT_DIR/logs/daily-kpi-collection.log"
    
    echo ""
    echo "📋 Current crontab:"
    crontab -l | grep -E "(daily-kpi-collector|#.*minute.*hour.*day.*month.*weekday)"
    
    echo ""
    echo "🔧 To manually run the collection script:"
    echo "cd $PROJECT_DIR && node $CRON_SCRIPT"
    
    echo ""
    echo "🗑️ To remove the cron job later:"
    echo "crontab -e  # then delete the daily-kpi-collector.js line"
    
else
    echo "❌ Failed to install cron job"
    exit 1
fi 