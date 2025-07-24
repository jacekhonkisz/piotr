# Meta Ads Automated Reporting SaaS MVP

A full-stack web SaaS platform for Meta Ads specialists to manage multiple clients and automate monthly campaign reporting.

## 🎯 Business Overview

This platform enables:
- **Admins** (Meta Ads specialists) to manage multiple clients and their Meta Ads campaigns
- **Clients** to access their own dashboard and view monthly campaign reports
- **Automated reporting** via email with PDF attachments on a monthly schedule
- **Secure data management** with client isolation and token security

## ✨ Key Features

### Admin Panel
- Add/edit/remove clients with Meta API credentials
- Manage reporting frequency (monthly/on-demand)
- View client status dashboard (token validity, last report date)
- Manual report generation and sending

### Meta Ads API Integration
- Secure storage of API credentials per client
- Automated data fetching via scheduled jobs
- Campaign metrics collection (impressions, clicks, spend, conversions)

### Automated Reporting
- Clean PDF report generation from HTML/CSS templates
- Monthly email automation with professional branding
- Report archiving for historical access

### Client Dashboard
- Secure authentication via Supabase Auth
- View and download past reports
- Mobile-responsive interface

## 🛠 Tech Stack

- **Frontend & Backend**: Next.js 14 (TypeScript)
- **Database & Auth**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel
- **Email Service**: Resend
- **PDF Generation**: Puppeteer
- **Scheduling**: Vercel Cron Jobs
- **API Integration**: Meta Graph API

## 📁 Project Structure

```
├── README.md
├── docs/
│   ├── requirements.md      # Business requirements & user stories
│   ├── api.md              # API documentation & Meta Ads integration
│   ├── report-template.md  # PDF template structure
│   ├── user-flows.md       # Admin & client user journeys
│   └── roadmap.md          # MVP features & future plans
├── src/
│   ├── pages/              # Next.js pages
│   ├── components/         # Reusable React components
│   ├── api/               # Next.js API routes
│   ├── utils/             # Helper functions
│   ├── styles/            # CSS/Tailwind styles
│   └── lib/               # External service clients
├── supabase/              # Database migrations
└── public/                # Static assets
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Supabase account
- Vercel account (for deployment)
- Meta Developer account (for API access)
- Resend account (for email service)

### Environment Setup

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd meta-ads-reporting-saas
npm install
```

2. **Set up environment variables:**
Copy `.env.local.example` to `.env.local` and fill in your credentials:
```bash
cp .env.local.example .env.local
```

3. **Configure Supabase:**
- Create a new Supabase project
- Run the migrations: `npm run db:migrate`
- Update your `.env.local` with Supabase credentials

4. **Start development server:**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `RESEND_API_KEY` | Resend API key for emails | ✅ |
| `META_APP_SECRET` | Meta App Secret for API | ✅ |
| `NEXTAUTH_SECRET` | Secret for session encryption | ✅ |
| `NEXTAUTH_URL` | Application URL | ✅ |

## 🗄 Database Schema

### Core Tables
- `profiles` - User profiles (admin/client roles)
- `clients` - Client information and Meta API credentials
- `reports` - Generated report metadata and storage
- `campaigns` - Meta Ads campaign data cache

## 📧 Email Configuration

The platform uses Resend for automated email delivery:
- Monthly report emails with PDF attachments
- Professional email templates
- Delivery tracking and error handling

## 🔒 Security Features

- **Authentication**: Supabase Auth with role-based access
- **API Security**: Protected routes with middleware
- **Data Isolation**: Clients can only access their own data
- **Token Management**: Encrypted storage of Meta API credentials
- **HTTPS**: Enforced in production via Vercel

## 📱 Responsive Design

Built with mobile-first approach using Tailwind CSS:
- Admin dashboard optimized for desktop
- Client dashboard fully responsive
- PDF reports optimized for print and mobile viewing

## 🚀 Deployment

### Vercel Deployment
```bash
npm run build
vercel --prod
```

### Environment Setup
1. Configure all environment variables in Vercel dashboard
2. Set up Supabase production database
3. Configure custom domain (optional)

## 📊 Monitoring & Analytics

- Supabase Dashboard for database monitoring
- Vercel Analytics for performance tracking
- Error logging via Vercel/Supabase functions
- Email delivery tracking via Resend

## 🔧 Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run db:migrate   # Run Supabase migrations
npm run db:reset     # Reset database (dev only)
```

## 📖 Documentation

- [Requirements & User Stories](./docs/requirements.md)
- [API Documentation](./docs/api.md)
- [Report Templates](./docs/report-template.md)
- [User Flows](./docs/user-flows.md)
- [Development Roadmap](./docs/roadmap.md)

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use meaningful commit messages
3. Update documentation for new features
4. Test all API integrations thoroughly

## 📄 License

Private - All rights reserved

---

**MVP Focus**: Core reporting automation with clean, minimal UI. No payments, team features, or advanced analytics in initial version. 