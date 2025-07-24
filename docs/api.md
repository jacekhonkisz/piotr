# API Documentation

## 🌐 Overview

This document outlines the API architecture for the Meta Ads Reporting SaaS, including internal Next.js API routes and external Meta Graph API integration.

## 🔐 Authentication Flow

### Supabase Authentication
- **Method**: JWT-based authentication via Supabase Auth
- **Roles**: `admin`, `client`
- **Session Management**: HTTP-only cookies with secure tokens
- **Token Refresh**: Automatic refresh handling

### API Route Protection
All internal API routes are protected using middleware that validates:
1. Valid Supabase JWT token
2. User role permissions
3. Resource ownership (clients can only access their data)

## 📡 Internal API Endpoints

### Authentication Endpoints

#### `POST /api/auth/login`
**Purpose**: Authenticate user credentials  
**Access**: Public  
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin|client"
  }
}
```

#### `POST /api/auth/logout`
**Purpose**: End user session  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Client Management Endpoints (Admin Only)

#### `GET /api/clients`
**Purpose**: Retrieve all clients  
**Access**: Admin only  
**Response**:
```json
{
  "clients": [
    {
      "id": "uuid",
      "name": "Client Name",
      "email": "client@example.com",
      "created_at": "2024-01-01T00:00:00Z",
      "last_report_date": "2024-01-01T00:00:00Z",
      "api_status": "valid|invalid|expired",
      "reporting_frequency": "monthly"
    }
  ]
}
```

#### `POST /api/clients`
**Purpose**: Create new client  
**Access**: Admin only  
**Request Body**:
```json
{
  "name": "Client Name",
  "email": "client@example.com",
  "meta_access_token": "encrypted_token",
  "ad_account_id": "act_123456789",
  "reporting_frequency": "monthly",
  "notes": "Optional notes"
}
```

#### `PUT /api/clients/[id]`
**Purpose**: Update client information  
**Access**: Admin only  
**Request Body**:
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "meta_access_token": "new_encrypted_token",
  "ad_account_id": "act_987654321",
  "reporting_frequency": "monthly"
}
```

#### `DELETE /api/clients/[id]`
**Purpose**: Delete client and associated data  
**Access**: Admin only  
**Response**:
```json
{
  "success": true,
  "message": "Client deleted successfully"
}
```

### Report Management Endpoints

#### `GET /api/reports`
**Purpose**: Get reports (filtered by user role)  
**Access**: Authenticated users  
**Query Parameters**:
- `client_id` (admin only)
- `start_date` (ISO date)
- `end_date` (ISO date)
- `limit` (default: 20)
- `offset` (default: 0)

**Response**:
```json
{
  "reports": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "date_range_start": "2024-01-01",
      "date_range_end": "2024-01-31",
      "generated_at": "2024-02-01T00:00:00Z",
      "file_url": "https://storage.url/report.pdf",
      "email_sent": true,
      "email_sent_at": "2024-02-01T00:00:00Z"
    }
  ],
  "total": 25,
  "has_more": true
}
```

#### `POST /api/reports/generate`
**Purpose**: Generate new report for client  
**Access**: Admin only  
**Request Body**:
```json
{
  "client_id": "uuid",
  "date_range_start": "2024-01-01",
  "date_range_end": "2024-01-31",
  "send_email": true
}
```

#### `GET /api/reports/[id]/download`
**Purpose**: Download PDF report  
**Access**: Admin or report owner  
**Response**: PDF file stream

### Meta Ads API Integration Endpoints

#### `POST /api/meta/validate-credentials`
**Purpose**: Validate Meta API credentials  
**Access**: Admin only  
**Request Body**:
```json
{
  "access_token": "meta_access_token",
  "ad_account_id": "act_123456789"
}
```
**Response**:
```json
{
  "valid": true,
  "account_name": "Business Account Name",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### `POST /api/meta/fetch-campaigns`
**Purpose**: Fetch campaign data for date range  
**Access**: Admin only (internal use)  
**Request Body**:
```json
{
  "client_id": "uuid",
  "date_range_start": "2024-01-01",
  "date_range_end": "2024-01-31"
}
```

### Email Endpoints

#### `POST /api/email/send-report`
**Purpose**: Send report via email  
**Access**: Admin only  
**Request Body**:
```json
{
  "report_id": "uuid",
  "recipient_email": "client@example.com",
  "custom_message": "Optional custom message"
}
```

## 🔗 Meta Graph API Integration

### Authentication
- **Method**: Access Tokens stored per client
- **Scope Required**: `ads_read`, `ads_management`
- **Token Storage**: Encrypted in database
- **Validation**: Regular token health checks

### Key API Endpoints Used

#### Get Ad Account Information
```
GET https://graph.facebook.com/v18.0/{ad-account-id}
?fields=name,account_status,currency,timezone_name
&access_token={access_token}
```

#### Get Campaigns
```
GET https://graph.facebook.com/v18.0/{ad-account-id}/campaigns
?fields=id,name,status,created_time,updated_time
&access_token={access_token}
```

#### Get Campaign Insights
```
GET https://graph.facebook.com/v18.0/{campaign-id}/insights
?fields=impressions,clicks,spend,conversions,ctr,cpc,cpp,frequency
&time_range={start_date,end_date}
&access_token={access_token}
```

### Rate Limiting
- **Limit**: 200 calls per hour per access token
- **Strategy**: Exponential backoff with retry logic
- **Monitoring**: Track API usage per client
- **Caching**: Store campaign data to reduce API calls

### Error Handling
```json
{
  "error": {
    "message": "Invalid OAuth access token",
    "type": "OAuthException",
    "code": 190,
    "fbtrace_id": "trace_id"
  }
}
```

Common error codes:
- `190`: Invalid access token
- `100`: Invalid parameter
- `613`: Rate limit exceeded
- `17`: User request limit reached

## 📊 Data Models

### Campaign Data Structure
```json
{
  "campaign_id": "123456789",
  "campaign_name": "Summer Sale Campaign",
  "status": "ACTIVE",
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "metrics": {
    "impressions": 125000,
    "clicks": 2500,
    "spend": 1250.00,
    "conversions": 45,
    "ctr": 2.0,
    "cpc": 0.50,
    "cpp": 27.78,
    "frequency": 1.25
  },
  "demographics": {
    "age_breakdown": {...},
    "gender_breakdown": {...},
    "location_breakdown": {...}
  }
}
```

### Report Metadata
```json
{
  "report_id": "uuid",
  "client_id": "uuid",
  "generated_at": "2024-02-01T00:00:00Z",
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "total_campaigns": 5,
  "total_spend": 6250.00,
  "total_conversions": 125,
  "file_size_bytes": 2048576,
  "generation_time_ms": 8500
}
```

## 🔄 Webhook Endpoints

### Email Delivery Status
```
POST /api/webhooks/email-status
```
Handles delivery status updates from Resend:
```json
{
  "type": "email.delivered",
  "data": {
    "email_id": "uuid",
    "to": "client@example.com",
    "delivered_at": "2024-01-01T00:00:00Z"
  }
}
```

## 🚀 Cron Job Endpoints

### Monthly Report Generation
```
GET /api/cron/generate-monthly-reports
```
- **Schedule**: 1st day of each month at 9:00 AM UTC
- **Purpose**: Generate and send monthly reports for all active clients
- **Security**: Vercel Cron Secret verification

### API Health Check
```
GET /api/cron/health-check
```
- **Schedule**: Daily at 6:00 AM UTC
- **Purpose**: Validate all client API credentials
- **Alerts**: Notify admin of expired/invalid tokens

## 🛡 Security Considerations

### API Security
- Rate limiting on all endpoints (100 requests/minute per IP)
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- CORS configuration for production domains only

### Data Protection
- Encryption at rest for sensitive data
- HTTPS enforcement in production
- Secure headers (HSTS, CSP, X-Frame-Options)
- Regular security audits

### Access Control
- JWT token validation on protected routes
- Role-based permissions enforcement
- Resource ownership verification
- Audit logging for sensitive operations

## 📈 Monitoring & Analytics

### API Metrics
- Response times by endpoint
- Error rates and types
- Request volume patterns
- User activity tracking

### Meta API Monitoring
- Token expiration tracking
- Rate limit usage
- API error frequency
- Data freshness monitoring

## 🧪 Testing Strategy

### Unit Tests
- API route handlers
- Meta API integration functions
- Data validation logic
- Error handling scenarios

### Integration Tests
- End-to-end report generation
- Email delivery workflows
- Authentication flows
- Database operations

### Load Testing
- API endpoint performance
- Concurrent user handling
- Database query optimization
- Email delivery capacity 