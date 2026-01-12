# BigQuery Data Transfer Service - Demographic Data Availability

## ⚠️ Important Clarification

**BigQuery Data Transfer Service for Google Ads likely has the SAME limitation as the Google Ads API.**

### Why?

1. **Same Data Source**: BigQuery DTS uses the same underlying Google Ads reporting infrastructure as the API
2. **API Limitation**: Since the Google Ads API doesn't provide demographic performance data (deprecated in 2012), BigQuery DTS likely has the same limitation
3. **No Confirmation**: There's no clear documentation confirming that BigQuery DTS includes demographic performance data that the API doesn't

### What BigQuery DTS DOES Provide:

- Campaign performance data
- Ad group performance
- Keyword performance
- Device performance
- Network performance
- Conversion data
- **BUT likely NOT demographic performance (age/gender breakdown)**

### To Verify:

You would need to:
1. Set up BigQuery Data Transfer Service
2. Check the actual schema/tables created
3. Query for demographic-related columns
4. Confirm if age/gender performance data exists

### Most Reliable Options:

1. **Browser Automation** - Scrape the UI data you can see
2. **Google Analytics API** - If linked, provides visitor demographics
3. **Manual Export** - Export from UI and import programmatically

