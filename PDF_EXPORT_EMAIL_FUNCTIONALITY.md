# PDF Export & Email Functionality - Complete Implementation

## Overview

The "Raporty Miesięczne" (Monthly Reports) page now includes comprehensive PDF export and email functionality that allows users to:

1. **Generate PDF Reports**: Download reports directly to their device
2. **Send Reports via Email**: Send PDF reports to clients with custom messages
3. **View Sent Reports**: Track all sent reports with preview and download capabilities
4. **Manage Report History**: Access a complete history of generated and sent reports

## 🎯 Features Implemented

### 1. PDF Generation
- **Direct Download**: Generate and download PDF reports instantly
- **Professional Design**: PDFs match the dashboard design with premium styling
- **Complete Data**: Includes all metrics, charts, and campaign data
- **Custom Filenames**: Automatically named with client and period information

### 2. Email Functionality
- **Custom Email Modal**: User-friendly interface for composing emails
- **Pre-filled Templates**: Default subject and message templates
- **Custom Recipients**: Send to any email address
- **PDF Attachments**: Automatically attach generated PDF to email
- **Email Tracking**: Log all sent emails with delivery status

### 3. Sent Reports Management
- **Report History**: View all sent reports from the last 12 months
- **Preview Functionality**: Preview PDFs directly in browser
- **Download Access**: Download any previously sent report
- **Status Tracking**: Track delivery status and file information
- **Search & Filter**: Easy navigation through sent reports

### 4. Database Integration
- **Sent Reports Table**: Dedicated table for tracking sent reports
- **Email Logs**: Comprehensive email delivery tracking
- **Storage Integration**: PDFs stored in Supabase Storage
- **RLS Policies**: Secure access control for all data

## 🏗️ Technical Architecture

### Frontend Components

#### 1. Reports Page (`src/app/reports/page.tsx`)
```typescript
// New state variables added
const [sendingEmail, setSendingEmail] = useState(false);
const [showSentReports, setShowSentReports] = useState(false);
const [sentReports, setSentReports] = useState<any[]>([]);
const [showEmailModal, setShowEmailModal] = useState(false);
const [emailRecipient, setEmailRecipient] = useState('');
const [emailSubject, setEmailSubject] = useState('');
const [emailMessage, setEmailMessage] = useState('');
```

#### 2. UI Components Added
- **Email Modal**: Custom modal for composing emails
- **Sent Reports Section**: Collapsible section showing report history
- **Action Buttons**: Generate PDF, Send Email, View Sent Reports
- **Status Messages**: Success/error notifications

### Backend API Endpoints

#### 1. Enhanced PDF Generation (`/api/generate-report-pdf`)
```typescript
// New parameters supported
{
  clientId: string;
  monthId: string;
  includeEmail: boolean;
  emailRecipient?: string;
  emailSubject?: string;
  emailMessage?: string;
}
```

#### 2. Sent Reports API (`/api/sent-reports`)
- **GET**: Retrieve sent reports with filtering
- **POST**: Create new sent report records

#### 3. Report Preview/Download (`/api/sent-reports/[id]/preview`, `/api/sent-reports/[id]/download`)
- Generate signed URLs for PDF access
- Secure file access with authentication

### Database Schema

#### 1. Sent Reports Table
```sql
CREATE TABLE sent_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  report_period TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  file_size_bytes INTEGER,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(client_id, report_period)
);
```

#### 2. Email Logs Table
```sql
CREATE TABLE email_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

#### 3. Storage Bucket
- **Bucket Name**: `reports`
- **File Type**: PDF only
- **Size Limit**: 50MB per file
- **Access**: Authenticated users only

## 🚀 How to Use

### 1. Generate PDF Report
1. Navigate to the "Raporty Miesięczne" page
2. Select the desired month from the period selector
3. Click the "Generuj PDF" (Generate PDF) button
4. The PDF will automatically download to your device

### 2. Send Report via Email
1. Select the desired month from the period selector
2. Click the "Wyślij Email" (Send Email) button
3. The email modal will open with pre-filled information
4. Customize the recipient, subject, and message if needed
5. Click "Wyślij Raport" (Send Report) to send the email
6. The PDF will be generated, attached, and sent automatically

### 3. View Sent Reports
1. Click the "Wysłane Raporty" (Sent Reports) button
2. The sent reports section will expand showing all sent reports
3. Use the "Podgląd" (Preview) button to view PDFs in browser
4. Use the "Pobierz" (Download) button to download PDFs

## 🔧 Configuration

### Environment Variables Required
```bash
# Email Configuration
EMAIL_FROM_ADDRESS=your-email@domain.com
EMAIL_SERVICE_API_KEY=your-email-service-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Email Service Setup
The system uses a custom EmailService class that supports:
- Multiple email providers (SendGrid, Mailgun, etc.)
- PDF attachments
- HTML email templates
- Delivery tracking

## 📊 Monitoring & Analytics

### 1. Email Delivery Tracking
- All emails are logged in the `email_logs` table
- Track delivery status, message IDs, and error messages
- Monitor email performance and delivery rates

### 2. Report Usage Analytics
- Track which reports are most frequently sent
- Monitor PDF generation and download patterns
- Analyze client engagement with reports

### 3. Storage Management
- Automatic cleanup of old reports (12-month retention)
- File size monitoring and optimization
- Storage cost tracking and management

## 🔒 Security Features

### 1. Authentication & Authorization
- All endpoints require valid JWT tokens
- RLS policies ensure users can only access their own data
- Admin users have access to all client data

### 2. File Security
- PDFs stored in secure Supabase Storage
- Signed URLs with expiration for file access
- No direct file access without authentication

### 3. Data Protection
- Email addresses and sensitive data encrypted
- Audit trails for all email sending activities
- Secure handling of client information

## 🐛 Troubleshooting

### Common Issues

#### 1. PDF Generation Fails
- **Cause**: Puppeteer not installed or configured
- **Solution**: Ensure Puppeteer is installed and headless mode is enabled

#### 2. Email Sending Fails
- **Cause**: Email service configuration issues
- **Solution**: Check email service API keys and configuration

#### 3. Storage Upload Fails
- **Cause**: Storage bucket not created or permissions incorrect
- **Solution**: Run the storage migration and check bucket policies

#### 4. Sent Reports Not Loading
- **Cause**: RLS policies blocking access
- **Solution**: Verify user permissions and RLS policy configuration

### Debug Commands
```bash
# Test PDF email functionality
node scripts/test-pdf-email-functionality.js

# Check database tables
npx supabase db diff

# Verify storage bucket
npx supabase storage ls --experimental
```

## 📈 Performance Optimization

### 1. PDF Generation
- Asynchronous processing to prevent UI blocking
- Caching of generated PDFs in storage
- Optimized HTML templates for faster rendering

### 2. Email Delivery
- Queue-based email sending for high volume
- Retry mechanisms for failed deliveries
- Batch processing for multiple recipients

### 3. Storage Management
- Automatic compression of PDF files
- Regular cleanup of unused files
- CDN integration for faster file access

## 🔄 Future Enhancements

### Planned Features
1. **Bulk Email Sending**: Send reports to multiple recipients
2. **Scheduled Reports**: Automatic report generation and sending
3. **Custom Templates**: User-defined email and PDF templates
4. **Advanced Analytics**: Detailed reporting on email engagement
5. **Mobile Optimization**: Enhanced mobile experience for report viewing

### Integration Opportunities
1. **CRM Integration**: Connect with popular CRM systems
2. **Slack/Teams**: Send reports to team channels
3. **API Access**: External API for report generation
4. **Webhook Support**: Real-time notifications for report events

## 📝 API Reference

### Generate PDF Report
```http
POST /api/generate-report-pdf
Content-Type: application/json
Authorization: Bearer <token>

{
  "clientId": "uuid",
  "monthId": "2025-01",
  "includeEmail": false
}
```

### Send Report Email
```http
POST /api/generate-report-pdf
Content-Type: application/json
Authorization: Bearer <token>

{
  "clientId": "uuid",
  "monthId": "2025-01",
  "includeEmail": true,
  "emailRecipient": "client@example.com",
  "emailSubject": "Monthly Report - January 2025",
  "emailMessage": "Please find attached..."
}
```

### Get Sent Reports
```http
GET /api/sent-reports?clientId=uuid&groupBy=date
Authorization: Bearer <token>
```

### Preview Sent Report
```http
GET /api/sent-reports/{id}/preview
Authorization: Bearer <token>
```

### Download Sent Report
```http
GET /api/sent-reports/{id}/download
Authorization: Bearer <token>
```

## 🎉 Conclusion

The PDF export and email functionality provides a complete solution for generating, sending, and managing monthly reports. The implementation includes:

- ✅ Professional PDF generation with dashboard styling
- ✅ Custom email composition and sending
- ✅ Comprehensive sent reports tracking
- ✅ Secure file storage and access
- ✅ Complete audit trail and monitoring
- ✅ Mobile-responsive UI
- ✅ Performance optimization
- ✅ Security best practices

The system is production-ready and provides a seamless experience for both administrators and clients when working with monthly reports. 