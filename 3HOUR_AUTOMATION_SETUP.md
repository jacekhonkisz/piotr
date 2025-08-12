# 3-Hour Automated Cache Refresh System

## Overview

This system automatically refreshes cache data every 3 hours for all clients to ensure data freshness without manual intervention.

## Features

✅ **Automated 3-hour refresh cycle**  
✅ **Smart cache age detection** - only refreshes stale data (>3 hours old)  
✅ **Batch processing** - handles multiple clients efficiently  
✅ **Error handling** - continues processing other clients if one fails  
✅ **Comprehensive logging** - detailed logs for monitoring  
✅ **Multiple deployment options** - Node.js, PM2, or system cron  

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Scheduler         │───▶│  Automation API      │───▶│   Cache Storage     │
│   (Every 3 hours)  │    │  /refresh-3hour      │    │   (Database)        │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
                                       │
                                       ▼
                           ┌──────────────────────┐
                           │   Meta API           │
                           │   (Fresh Data)       │
                           └──────────────────────┘
```

## Quick Setup

### 1. Test the Automation

```bash
# Test the endpoint manually
node scripts/test-3hour-automation.js
```

### 2. Setup Automation

```bash
# Run the setup script
node scripts/setup-3hour-automation.js
```

### 3. Start the Scheduler

Choose one of these options:

#### Option A: Node.js Scheduler (Development)
```bash
# Start the scheduler
node scripts/3hour-scheduler.js
```

#### Option B: PM2 (Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.3hour.config.js

# View logs
pm2 logs 3hour-cache-refresh

# Monitor
pm2 monit
```

#### Option C: System Cron (Server)
```bash
# Edit crontab
crontab -e

# Add this line (replace URL and KEY with your values):
0 */3 * * * curl -X POST "YOUR_URL/api/automated/refresh-3hour-cache" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_KEY" >> /var/log/3hour-refresh.log 2>&1
```

## API Endpoint

### `POST /api/automated/refresh-3hour-cache`

**Purpose**: Automatically refresh cache data for all clients when it's older than 3 hours.

**Authentication**: Requires `SUPABASE_SERVICE_ROLE_KEY`

**Response**:
```json
{
  "success": true,
  "message": "3-hour automated cache refresh completed",
  "summary": {
    "totalClients": 2,
    "successful": 1,
    "errors": 0,
    "skipped": 1,
    "responseTime": 12543
  },
  "results": [
    {
      "clientId": "ab0b4c7e-2bf0-46bc-b455-b18ef6942baa",
      "clientName": "Belmonte Hotel",
      "status": "success",
      "monthlyCache": {
        "status": "success",
        "campaigns": 100,
        "spend": 4369.53
      },
      "weeklyCache": {
        "status": "skipped",
        "reason": "fresh"
      },
      "responseTime": 6206,
      "refreshedAt": "2025-08-12T10:15:38.930Z"
    }
  ]
}
```

## Smart Logic

The system uses intelligent cache age detection:

1. **Check cache age** for each client
2. **Skip if fresh** (< 3 hours old)
3. **Refresh if stale** (≥ 3 hours old)
4. **Update both monthly and weekly** caches as needed
5. **Process in batches** to avoid overwhelming APIs

## Monitoring

### View Logs

```bash
# Real-time logs
tail -f logs/3hour-refresh.log

# PM2 logs
pm2 logs 3hour-cache-refresh

# System logs (if using cron)
tail -f /var/log/3hour-refresh.log
```

### Log Format

```
2025-08-12T12:00:00.000Z [INFO] 3-hour automated cache refresh started
🔄 Starting 3-hour automated refresh for 2 clients
📅 Current Month: 2025-08
📅 Current Week: 2025-W32
📦 Processing batch 1/1
📊 Processing 3-hour refresh for: Belmonte Hotel (ab0b4c7e-...)
📊 Belmonte Hotel cache status: {monthlyAge: 23.2h, weeklyAge: 1.8h, needsMonthlyRefresh: true, needsWeeklyRefresh: false}
🔄 Refreshing monthly cache for Belmonte Hotel...
✅ Monthly refresh completed for Belmonte Hotel
✅ 3-hour refresh completed: {totalClients: 2, successful: 1, errors: 0, skipped: 1, totalTime: 12.5s}
```

## Configuration

### Cache Duration

Current settings (can be modified in code):

- **Monthly Cache**: 6 hours (was 3 hours)
- **Weekly Cache**: 3 hours
- **Automation Trigger**: Every 3 hours

### Batch Settings

- **Batch Size**: 2 clients at a time
- **Batch Delay**: 3 seconds between batches
- **Request Timeout**: 30 seconds per API call

## Troubleshooting

### Common Issues

**1. Environment Variables Missing**
```bash
# Check if variables are set
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

**2. Endpoint Not Working**
```bash
# Test the endpoint
node scripts/test-3hour-automation.js
```

**3. PM2 Process Crashed**
```bash
# Check PM2 status
pm2 status

# Restart if needed
pm2 restart 3hour-cache-refresh

# View error logs
pm2 logs 3hour-cache-refresh --err
```

**4. Cron Job Not Running**
```bash
# Check if cron is running
sudo service cron status

# View cron logs
grep CRON /var/log/syslog

# Test cron entry manually
curl -X POST "YOUR_URL" -H "Authorization: Bearer YOUR_KEY"
```

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
export DEBUG=true
node scripts/3hour-scheduler.js
```

## Performance

### Expected Performance

- **2 clients**: ~12-15 seconds
- **5 clients**: ~30-40 seconds  
- **10 clients**: ~60-80 seconds

### Resource Usage

- **Memory**: ~50-100MB per scheduler process
- **CPU**: Low (only during 3-hour refresh cycles)
- **Network**: Depends on campaign count per client

## Production Checklist

- [ ] Environment variables configured
- [ ] PM2 installed and configured
- [ ] Log rotation setup
- [ ] Monitoring alerts configured
- [ ] Backup automation tested
- [ ] Error notification setup

## File Structure

```
project/
├── src/app/api/automated/
│   └── refresh-3hour-cache/
│       └── route.ts                    # Main automation endpoint
├── scripts/
│   ├── setup-3hour-automation.js      # Setup script
│   ├── test-3hour-automation.js       # Testing script
│   └── 3hour-scheduler.js             # Generated scheduler
├── logs/
│   ├── 3hour-refresh.log              # Application logs
│   ├── 3hour-refresh-out.log          # PM2 stdout
│   └── 3hour-refresh-error.log        # PM2 stderr
├── ecosystem.3hour.config.js          # PM2 configuration
└── 3HOUR_AUTOMATION_SETUP.md          # This documentation
```

## Next Steps

1. **Test the system**: `node scripts/test-3hour-automation.js`
2. **Choose deployment method**: Node.js, PM2, or Cron
3. **Setup monitoring**: Configure log alerts
4. **Monitor performance**: Check logs after first few cycles

---

## Support

If you encounter issues:

1. Check the logs first
2. Test the endpoint manually
3. Verify environment variables
4. Check network connectivity to Supabase and Meta APIs 