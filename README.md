# Meta Ads Reporting SaaS Platform

A comprehensive SaaS platform for automated Meta Ads reporting and client management. This system allows admins to add clients with real Meta Ads API integration, generate beautiful performance reports, and provide clients with secure access to their analytics dashboard.

## 🚀 Features

### Admin Features
- **Real Meta Ads API Integration**: Validates and connects to actual Meta Ads accounts
- **Client Management**: Add, edit, and manage client accounts with secure credential generation
- **Automated Report Generation**: Fetch real campaign data and generate comprehensive reports
- **Credential Management**: Generate secure passwords and usernames for clients
- **Email Notifications**: Send welcome emails and report notifications to clients

### Client Features
- **Secure Login**: Email/password authentication with role-based access
- **Dashboard Analytics**: View performance metrics, spend analysis, and campaign insights
- **Report Library**: Access historical reports with detailed campaign breakdowns
- **Real-time Data**: Connect to live Meta Ads API for current performance data
- **Export Capabilities**: Download reports and campaign data

### Technical Features
- **Next.js 14**: Modern React framework with App Router
- **TypeScript**: Full type safety throughout the application
- **Supabase**: Authentication, database, and real-time features
- **Meta Ads API**: Real integration with Facebook/Instagram Ads API
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Email Integration**: Professional email templates with Resend

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin Panel   │    │  Client Portal  │    │  Meta Ads API   │
│                 │    │                 │    │                 │
│ • Add Clients   │    │ • View Reports  │    │ • Campaign Data │
│ • Manage Users  │    │ • Analytics     │    │ • Performance   │
│ • Generate      │    │ • Export Data   │    │ • Demographics  │
│   Reports       │    │ • Dashboard     │    │ • Insights      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Supabase DB   │
                    │                 │
                    │ • Users         │
                    │ • Clients       │
                    │ • Reports       │
                    │ • Campaigns     │
                    └─────────────────┘
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Meta Ads API access
- Resend account (for emails)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd meta-ads-reporting-saas
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Email Configuration (Resend)
RESEND_API_KEY=your_resend_api_key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Meta Ads API (for testing)
META_ACCESS_TOKEN=your_test_meta_token
```

### 4. Database Setup
```bash
# Generate database types
npm run db:generate

# Run migrations
npm run db:migrate

# Setup initial admin user
npm run setup
```

### 5. Start Development Server
```bash
npm run dev
```

## 📊 Database Schema

### Core Tables

#### `profiles`
- User authentication and role management
- Supports `admin` and `client` roles

#### `clients`
- Client information and Meta Ads credentials
- Stores generated usernames and passwords
- Tracks API status and reporting frequency

#### `reports`
- Generated report metadata
- Links to campaign data and generation metrics

#### `campaigns`
- Individual campaign performance data
- Fetched from Meta Ads API
- Includes metrics like spend, impressions, clicks, etc.

## 🔐 Authentication & Security

### User Roles
- **Admin**: Full access to client management and system administration
- **Client**: Access to their own reports and analytics

### Security Features
- JWT-based authentication via Supabase
- Role-based access control
- Secure password generation for clients
- API token encryption
- CSRF protection

## 📈 Meta Ads Integration

### API Features
- **Token Validation**: Verifies Meta Ads access tokens
- **Account Access**: Validates ad account permissions
- **Campaign Data**: Fetches real campaign performance metrics
- **Insights**: Retrieves detailed analytics and demographics

### Supported Metrics
- Impressions, clicks, spend
- Click-through rate (CTR)
- Cost per click (CPC)
- Cost per thousand impressions (CPM)
- Conversions and conversion rate
- Reach and frequency
- Demographics breakdown

## 🎨 User Interface

### Admin Dashboard
- Client management interface
- Report generation controls
- System analytics and overview
- User credential management

### Client Dashboard
- Performance overview with key metrics
- Recent reports and campaign data
- Interactive charts and visualizations
- Export and download capabilities

### Responsive Design
- Mobile-first approach
- Modern UI with Tailwind CSS
- Accessible design patterns
- Professional email templates

## 📧 Email System

### Email Templates
- **Welcome Email**: Client credentials and dashboard access
- **Report Notification**: New report availability
- **Error Notification**: Report generation failures

### Email Features
- Professional HTML templates
- Responsive design
- Branded styling
- Automated delivery

## 🚀 Deployment

### Production Setup
1. **Database**: Use Supabase production instance
2. **Hosting**: Deploy to Vercel, Netlify, or similar
3. **Email**: Configure Resend production account
4. **Environment**: Set production environment variables

### Environment Variables (Production)
```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
RESEND_API_KEY=your_production_resend_key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## 🔧 API Endpoints

### Report Generation
```
POST /api/generate-report
```
Generates new Meta Ads report for authenticated client

### Authentication
- All endpoints require valid JWT token
- Role-based access control
- Client isolation (clients can only access their own data)

## 📝 Usage Guide

### For Admins

1. **Adding a New Client**
   - Navigate to Admin Panel
   - Click "Add Client"
   - Enter company information
   - Add Meta Ads Account ID and Access Token
   - Validate credentials
   - System generates secure login credentials
   - Client receives welcome email

2. **Generating Reports**
   - Select client from admin dashboard
   - Click "Generate Report"
   - System fetches data from Meta Ads API
   - Report is stored and client is notified

3. **Managing Clients**
   - View all clients and their status
   - Regenerate credentials if needed
   - Monitor API connection status
   - Access client reports and analytics

### For Clients

1. **First Login**
   - Use credentials from welcome email
   - Change password on first login
   - Access dashboard with performance overview

2. **Viewing Reports**
   - Browse recent reports
   - View detailed campaign performance
   - Export data for external analysis
   - Access historical data

3. **Dashboard Features**
   - Real-time performance metrics
   - Campaign comparison tools
   - Trend analysis and insights
   - Custom date range filtering

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Test Coverage
- API endpoint testing
- Component testing
- Database integration tests
- Meta Ads API mocking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Roadmap

### Upcoming Features
- [ ] Advanced analytics and forecasting
- [ ] Custom report templates
- [ ] Multi-language support
- [ ] API rate limiting and caching
- [ ] Advanced export formats (Excel, PowerPoint)
- [ ] Real-time notifications
- [ ] Mobile app development
- [ ] White-label solutions

### Performance Optimizations
- [ ] Database query optimization
- [ ] API response caching
- [ ] Image optimization
- [ ] Bundle size reduction
- [ ] CDN integration

---

**Built with ❤️ using Next.js, TypeScript, and Supabase** 