# AI Summary Production Deployment Guide

This guide covers the production deployment and configuration of the AI summary generation system.

## Overview

The AI summary generation system has been enhanced with production-ready features including:
- Rate limiting to prevent abuse
- Cost tracking and budget controls
- Retry logic with exponential backoff
- Comprehensive error handling
- Fallback mechanisms
- Performance monitoring

## Environment Variables

### Required Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=300
OPENAI_TEMPERATURE=0.5
OPENAI_MAX_RETRIES=3
OPENAI_RETRY_DELAY_MS=1000

# AI Summary Configuration
AI_CHEAP_MODE=false
AI_FALLBACK_ENABLED=true
AI_USE_FALLBACK_IN_DEV=true
AI_USE_FALLBACK_IN_CHEAP_MODE=true

# Cost Control
AI_MAX_DAILY_COST=10.0
AI_MAX_MONTHLY_COST=300.0

# Rate Limiting
AI_RATE_LIMIT_PER_MINUTE=60
AI_RATE_LIMIT_PER_HOUR=1000
AI_RATE_LIMIT_PER_DAY=10000

# Monitoring
AI_LOG_PERFORMANCE=true
AI_LOG_COSTS=true
AI_LOG_ERRORS=true
```

### Optional Environment Variables

```bash
# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Production Features

### 1. Rate Limiting

The system implements multi-tier rate limiting:
- **Per Minute**: 60 requests
- **Per Hour**: 1,000 requests  
- **Per Day**: 10,000 requests

Rate limits are applied per client ID to prevent abuse while allowing legitimate usage.

### 2. Cost Control

Built-in cost tracking and budget controls:
- **Daily Limit**: $10 per day (configurable)
- **Monthly Limit**: $300 per month (configurable)
- **Real-time Cost Tracking**: Monitors token usage and costs
- **Automatic Fallback**: Switches to fallback summaries when limits are exceeded

### 3. Retry Logic

Robust retry mechanism for OpenAI API calls:
- **Max Retries**: 3 attempts (configurable)
- **Exponential Backoff**: Increasing delay between retries
- **Rate Limit Handling**: Respects OpenAI's retry-after headers
- **Graceful Degradation**: Falls back to local summaries on failure

### 4. Error Handling

Comprehensive error handling:
- **Input Validation**: Validates all input data before processing
- **API Error Handling**: Handles all OpenAI API error responses
- **Fallback Mechanisms**: Always provides a summary, even on failure
- **Detailed Logging**: Logs all errors for debugging and monitoring

### 5. Performance Monitoring

Built-in performance tracking:
- **Response Times**: Tracks API call duration
- **Token Usage**: Monitors token consumption
- **Cost Tracking**: Real-time cost monitoring
- **Success Rates**: Tracks success/failure rates

## Deployment Steps

### 1. Environment Setup

1. Copy the environment variables to your production environment
2. Set `NODE_ENV=production`
3. Configure your OpenAI API key
4. Set appropriate cost and rate limits

### 2. Database Configuration

Ensure your database is properly configured:
- Supabase connection strings
- Proper indexes for performance
- Backup and recovery procedures

### 3. Monitoring Setup

Set up monitoring for:
- Application logs
- Error tracking
- Performance metrics
- Cost alerts

### 4. Testing

Before going live:
1. Run the test suite: `npm test`
2. Test rate limiting
3. Test cost controls
4. Test fallback mechanisms
5. Load test the system

## Configuration Options

### OpenAI Model Configuration

```typescript
// Default configuration
{
  model: 'gpt-3.5-turbo',
  maxTokens: 300,
  temperature: 0.5,
  maxRetries: 3,
  retryDelayMs: 1000
}
```

### Cost Control Configuration

```typescript
// Default cost limits
{
  maxDailyCost: 10.0,    // $10 per day
  maxMonthlyCost: 300.0, // $300 per month
  costPerToken: 0.0015 / 1000 // $0.0015 per 1K tokens
}
```

### Rate Limiting Configuration

```typescript
// Default rate limits
{
  maxRequestsPerMinute: 60,
  maxRequestsPerHour: 1000,
  maxRequestsPerDay: 10000
}
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **API Response Times**
   - Average response time
   - 95th percentile response time
   - Timeout rates

2. **Cost Metrics**
   - Daily cost
   - Monthly cost
   - Cost per request
   - Token usage

3. **Error Rates**
   - API failure rate
   - Fallback usage rate
   - Rate limit hits

4. **Usage Patterns**
   - Requests per minute/hour/day
   - Peak usage times
   - Client usage patterns

### Recommended Alerts

1. **Cost Alerts**
   - Daily cost exceeds 80% of limit
   - Monthly cost exceeds 80% of limit
   - Unusual cost spikes

2. **Error Alerts**
   - API error rate > 5%
   - Fallback usage rate > 20%
   - Rate limit hits > 10%

3. **Performance Alerts**
   - Average response time > 10 seconds
   - 95th percentile response time > 30 seconds
   - Timeout rate > 1%

## Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**
   - Check rate limit configuration
   - Monitor client usage patterns
   - Consider increasing limits if needed

2. **Cost Overruns**
   - Review cost limits
   - Check for unusual usage patterns
   - Consider implementing per-client limits

3. **API Failures**
   - Check OpenAI API status
   - Verify API key configuration
   - Review retry logic

4. **Performance Issues**
   - Monitor response times
   - Check database performance
   - Review server resources

### Debugging

1. **Enable Debug Logging**
   ```bash
   AI_LOG_PERFORMANCE=true
   AI_LOG_COSTS=true
   AI_LOG_ERRORS=true
   ```

2. **Check Logs**
   - Application logs
   - Error logs
   - Performance logs

3. **Monitor Metrics**
   - Cost tracking
   - Rate limiting
   - API usage

## Security Considerations

1. **API Key Security**
   - Store API keys securely
   - Use environment variables
   - Rotate keys regularly

2. **Rate Limiting**
   - Implement per-client limits
   - Monitor for abuse
   - Block suspicious activity

3. **Cost Controls**
   - Set appropriate limits
   - Monitor usage patterns
   - Implement alerts

4. **Data Privacy**
   - Don't log sensitive data
   - Use secure connections
   - Follow data protection regulations

## Maintenance

### Regular Tasks

1. **Monitor Costs**
   - Review daily/monthly costs
   - Adjust limits as needed
   - Clean up old data

2. **Review Logs**
   - Check for errors
   - Monitor performance
   - Identify issues

3. **Update Configuration**
   - Adjust rate limits
   - Update cost limits
   - Optimize settings

4. **Test Fallbacks**
   - Verify fallback mechanisms
   - Test error handling
   - Ensure reliability

### Backup and Recovery

1. **Configuration Backup**
   - Backup environment variables
   - Document configuration changes
   - Version control settings

2. **Data Backup**
   - Backup cost tracking data
   - Backup rate limiting data
   - Backup configuration

3. **Recovery Procedures**
   - Document recovery steps
   - Test recovery procedures
   - Maintain runbooks

## Support

For issues or questions:
1. Check the logs first
2. Review this documentation
3. Check the test suite
4. Contact the development team

## Changelog

### Version 1.0.0
- Initial production release
- Rate limiting implementation
- Cost tracking and controls
- Retry logic with exponential backoff
- Comprehensive error handling
- Fallback mechanisms
- Performance monitoring
- Production configuration
- Comprehensive testing
