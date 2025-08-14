# Admin Calendar System - Implementation Guide

## Overview

The Admin Calendar System is a comprehensive solution for managing report sending schedules in the admin dashboard. It provides a centralized interface for viewing, creating, and managing scheduled email reports for all clients.

## Features

### 🗓️ Calendar View
- **Monthly Calendar Display**: Visual calendar showing all scheduled reports
- **Day-by-Day View**: See all scheduled reports for each day
- **Status Indicators**: Color-coded status badges (sent, pending, failed)
- **Interactive Day Selection**: Click on any day to create new schedules

### 📋 List View
- **Comprehensive List**: All scheduled reports in chronological order
- **Advanced Filtering**: Filter by status, client, or report type
- **Quick Actions**: Send reports immediately, view details, edit schedules
- **Error Tracking**: See error messages for failed reports

### ➕ Schedule Management
- **Create Schedules**: Set up one-time or recurring report schedules
- **Edit Schedules**: Modify existing schedules (if not yet sent)
- **Delete Schedules**: Remove scheduled reports
- **Recurring Options**: Set up automatic recurring schedules

### 📊 Dashboard Integration
- **Summary Cards**: Overview of sent, pending, and failed reports
- **Quick Stats**: Total active clients and overdue reports
- **Navigation Links**: Seamless integration with existing admin pages

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── calendar/
│   │   │   └── page.tsx          # Main calendar interface
│   │   └── ...
│   └── api/
│       └── admin/
│           └── schedule-report/
│               └── route.ts       # Calendar API endpoints
├── components/
│   └── ...
└── lib/
    ├── email-scheduler.ts         # Email scheduling logic
    └── ...
```

## Database Schema

The calendar system uses the existing `email_scheduler_logs` table:

```sql
CREATE TABLE email_scheduler_logs (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  admin_id UUID REFERENCES profiles(id),
  operation_type TEXT NOT NULL,     -- 'scheduled', 'manual', 'retry'
  frequency TEXT NOT NULL,          -- 'monthly', 'weekly', 'custom'
  send_day INTEGER,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### `POST /api/admin/schedule-report`
Create a new scheduled report.

**Request Body:**
```json
{
  "clientId": "uuid",
  "scheduledDate": "2024-01-15",
  "reportType": "monthly|weekly|custom",
  "recurring": false,
  "description": "Optional description"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule created successfully",
  "data": {
    "id": "uuid",
    "clientName": "Client Name",
    "scheduledDate": "2024-01-15",
    "reportPeriod": {
      "start": "2023-12-01",
      "end": "2023-12-31"
    },
    "recurring": false
  }
}
```

### `GET /api/admin/schedule-report`
Retrieve scheduled reports with optional filtering.

**Query Parameters:**
- `start`: Start date filter (YYYY-MM-DD)
- `end`: End date filter (YYYY-MM-DD)
- `clientId`: Filter by specific client

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "client_name": "Client Name",
      "client_email": "client@example.com",
      "operation_type": "scheduled",
      "frequency": "monthly",
      "send_day": 15,
      "report_period_start": "2023-12-01",
      "report_period_end": "2023-12-31",
      "email_sent": false,
      "email_sent_at": null,
      "error_message": null,
      "created_at": "2024-01-01T00:00:00Z",
      "status": "pending"
    }
  ]
}
```

### `PUT /api/admin/schedule-report?id=uuid`
Update an existing schedule (only if not yet sent).

**Request Body:**
```json
{
  "scheduledDate": "2024-01-20",
  "reportType": "weekly",
  "description": "Updated description"
}
```

### `DELETE /api/admin/schedule-report?id=uuid`
Delete a scheduled report (only if not yet sent).

## Navigation Integration

The calendar system is integrated into the admin navigation:

### Main Admin Page
- Added "Kalendarz wysyłek" button in the header
- Links to `/admin/calendar`

### Email Schedule Page
- Added navigation button to calendar
- Consistent styling with existing admin pages

### Calendar Page
- Navigation back to main admin and email schedule pages
- Breadcrumb-style navigation

## Usage Guide

### Accessing the Calendar
1. Log in as an admin user
2. Navigate to the admin dashboard
3. Click "Kalendarz wysyłek" in the header navigation

### Creating a New Schedule
1. In calendar view, click on any day
2. Or click "Nowy harmonogram" button
3. Fill in the schedule form:
   - Select client
   - Choose date
   - Select report type (monthly/weekly/custom)
   - Optionally enable recurring
4. Submit the form

### Managing Existing Schedules
1. **View Mode**: Switch between month and list views
2. **Edit**: Click edit icon (only for pending schedules)
3. **Delete**: Click delete icon (only for pending schedules)
4. **Send Now**: Click send icon for immediate delivery

### Understanding Status Indicators
- 🟢 **Sent**: Report has been successfully sent
- 🟡 **Pending**: Report is scheduled but not yet sent
- 🔴 **Failed**: Report sending encountered an error

## Integration with Existing Systems

### Email Scheduler
The calendar integrates with the existing `EmailScheduler` class:
- Uses the same database tables
- Follows existing scheduling logic
- Maintains compatibility with automated scheduling

### Admin Dashboard
- Consistent styling with existing admin pages
- Uses premium CSS classes for uniform appearance
- Integrates with existing authentication system

### Client Management
- Links to existing client detail pages
- Shows client information in schedules
- Respects client API status restrictions

## Error Handling

### Client-Side
- Form validation for required fields
- Loading states during API calls
- User-friendly error messages
- Graceful fallbacks for network issues

### Server-Side
- Input validation and sanitization
- Database transaction handling
- Detailed error logging
- Proper HTTP status codes

## Security Considerations

### Authentication
- Requires admin role to access calendar
- Uses existing auth middleware
- Validates user permissions for all operations

### Data Validation
- Server-side validation of all inputs
- Client-side validation for user experience
- Protection against SQL injection
- Proper date and UUID validation

### Row Level Security (RLS)
- Uses existing RLS policies
- Admin-only access to scheduler logs
- Client data isolation maintained

## Performance Optimizations

### Database
- Proper indexing on date and client columns
- Efficient queries with date range filtering
- Pagination for large datasets

### Frontend
- Lazy loading of calendar components
- Memoization of expensive calculations
- Optimized re-rendering strategies

### Caching
- Client-side caching of calendar data
- Efficient state management
- Minimal API calls on navigation

## Testing Strategy

### Unit Tests
- API endpoint testing
- Component functionality testing
- Date calculation validation

### Integration Tests
- Full calendar workflow testing
- Database integration testing
- Email scheduler integration

### Manual Testing
- Cross-browser compatibility
- Mobile responsiveness
- User experience validation

## Deployment Considerations

### Environment Variables
Ensure these are set in production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Email service configuration

### Database Migration
The system uses existing migration `021_add_email_scheduling.sql`:
```bash
# Already applied in existing systems
# No additional migrations needed
```

### Monitoring
- Set up logging for calendar operations
- Monitor API endpoint performance
- Track user engagement with calendar features

## Future Enhancements

### Planned Features
- **Bulk Operations**: Schedule multiple reports at once
- **Templates**: Save and reuse schedule configurations
- **Notifications**: Email notifications for schedule changes
- **Advanced Filtering**: More granular filtering options
- **Export**: Export calendar data to CSV/PDF

### Potential Improvements
- **Drag & Drop**: Move schedules between dates
- **Time Zones**: Support for different time zones
- **Approval Workflow**: Multi-step approval process
- **Analytics**: Detailed reporting on schedule performance

## Troubleshooting

### Common Issues
1. **Calendar not loading**: Check authentication and API connectivity
2. **Schedules not appearing**: Verify date range and filters
3. **Cannot create schedule**: Check client API status and permissions
4. **Email not sending**: Review email scheduler configuration

### Debug Steps
1. Check browser console for errors
2. Verify API responses in network tab
3. Check server logs for backend errors
4. Validate database constraints

## Support

For technical support or questions about the calendar system:
1. Check this documentation first
2. Review existing GitHub issues
3. Contact the development team
4. Create a new issue with detailed reproduction steps

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Author**: AI Assistant 