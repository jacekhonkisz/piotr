# Admin Features Documentation

## Overview

The admin dashboard now includes enhanced functionality for managing clients and generating comprehensive Meta Ads reports.

## Key Features

### 1. Client Management with Auto-Generated Credentials

When adding a new client, the system automatically:
- Validates the Meta access token
- Generates secure username and password credentials
- Stores encrypted credentials in the database
- Displays credentials to the admin for secure sharing

#### Credential Generation Process

1. **Username Generation**: Based on client name and company (e.g., `john.techcorp.abc1`)
2. **Password Generation**: 12-character secure password with mixed characters
3. **Storage**: Password is hashed using SHA-256 before storage
4. **Display**: Credentials are shown once in a modal with copy functionality

### 2. Meta Ads Reporting

The system provides comprehensive reporting capabilities:

#### Report Components
- **Account Summary**: Total spend, conversions, average CPA, active campaigns
- **Performance Metrics**: Impressions, clicks, CTR, CPC
- **Campaign Overview**: Total vs active campaigns, generation timestamp
- **Detailed Campaign Table**: Individual campaign performance data

#### Data Sources
- Meta Business API v18.0
- Real-time campaign insights
- Account-level metrics
- Historical performance data

### 3. Enhanced Admin Interface

#### Client List Features
- View client status and API connection health
- Generate reports for individual clients
- Access client credentials
- Manage reporting frequency
- Delete clients with confirmation

#### Report Generation
- Customizable date ranges
- Real-time data fetching from Meta API
- Comprehensive metrics display
- Export-ready format

## Technical Implementation

### Database Schema

The `clients` table includes new fields:
- `generated_username`: Auto-generated username for client login
- `generated_password`: Hashed password for security
- `credentials_generated_at`: Timestamp of credential generation

### API Integration

#### Meta API Service (`src/lib/meta-api.ts`)
- Token validation
- Ad account retrieval
- Campaign insights fetching
- Account-level metrics
- Comprehensive report generation

#### User Credentials (`src/lib/user-credentials.ts`)
- Secure password generation
- Username creation logic
- Password hashing utilities
- Credential verification

### Components

#### ClientReport Component (`src/components/ClientReport.tsx`)
- Modal-based report display
- Interactive date range selection
- Real-time data refresh
- Responsive design for all screen sizes

#### Enhanced Admin Page (`src/app/admin/clients/page.tsx`)
- Credential generation modal
- Report viewing integration
- Improved client management interface

## Security Considerations

1. **Password Security**: All passwords are hashed using SHA-256
2. **Token Storage**: Meta access tokens are stored securely
3. **Credential Display**: Credentials are only shown once upon creation
4. **Access Control**: Admin-only access to client management features

## Usage Instructions

### Adding a New Client

1. Navigate to Admin → Clients
2. Click "Add Client"
3. Fill in client information:
   - Name and email
   - Company (optional)
   - Meta access token
   - Ad account selection
   - Reporting frequency
4. Validate the Meta token
5. Save client - credentials will be generated automatically
6. Copy and securely share the generated credentials

### Generating Reports

1. In the client list, click the report icon (📄)
2. Select desired date range
3. View comprehensive Meta Ads performance data
4. Use refresh button to update data

### Managing Credentials

1. Click the key icon (🔑) next to any client
2. View or regenerate credentials as needed
3. Ensure secure transmission to clients

## Error Handling

- **Invalid Tokens**: Clear error messages for token validation failures
- **API Limits**: Graceful handling of Meta API rate limits
- **Network Issues**: Retry mechanisms for failed API calls
- **Data Validation**: Input validation for all forms

## Future Enhancements

- PDF report generation
- Email delivery of reports
- Automated credential rotation
- Advanced analytics and trends
- Multi-account support per client 