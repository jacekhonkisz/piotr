#!/bin/bash

# Meta Ads Reporting SaaS - Vercel Deployment Script
# This script automates the deployment process to Vercel

set -e  # Exit on any error

echo "🚀 Starting Vercel deployment for Meta Ads Reporting SaaS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vercel CLI is installed
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
        print_success "Vercel CLI installed successfully"
    else
        print_success "Vercel CLI is already installed"
    fi
}

# Check if user is logged in to Vercel
check_vercel_auth() {
    print_status "Checking Vercel authentication..."
    if ! vercel whoami &> /dev/null; then
        print_warning "Not logged in to Vercel. Please login..."
        vercel login
    else
        print_success "Already logged in to Vercel"
    fi
}

# Run pre-deployment checks
run_checks() {
    print_status "Running pre-deployment checks..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Make sure you're in the project root."
        exit 1
    fi
    
    # Check if vercel.json exists
    if [ ! -f "vercel.json" ]; then
        print_error "vercel.json not found. This file is required for cron jobs."
        exit 1
    fi
    
    # Check if environment template exists
    if [ ! -f "env.production.template" ]; then
        print_warning "env.production.template not found. Creating one..."
        create_env_template
    fi
    
    print_success "Pre-deployment checks passed"
}

# Create environment template if it doesn't exist
create_env_template() {
    cat > env.production.template << 'EOF'
# Production Environment Variables Template
# Copy this file to .env.local and fill in your actual values

# Application Environment
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key

# Email Service (Resend)
RESEND_API_KEY=your-production-resend-key

# Application URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Error Tracking (Sentry)
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=your-public-sentry-dsn

# Logging
LOG_LEVEL=info

# Meta API (if needed for health checks)
META_ACCESS_TOKEN=your-meta-access-token

# OpenAI API for AI Executive Summaries
OPENAI_API_KEY=your-openai-api-key
EOF
    print_success "Environment template created"
}

# Build the application locally to check for errors
build_locally() {
    print_status "Building application locally to check for errors..."
    
    # Install dependencies
    npm install
    
    # Run type check
    npm run type-check
    
    # Build the application
    npm run build
    
    print_success "Local build completed successfully"
}

# Deploy to Vercel
deploy_to_vercel() {
    print_status "Deploying to Vercel..."
    
    # Ask user about deployment type
    echo -e "${BLUE}Select deployment type:${NC}"
    echo "1) Preview deployment"
    echo "2) Production deployment"
    read -p "Enter choice (1 or 2): " choice
    
    case $choice in
        1)
            print_status "Creating preview deployment..."
            vercel deploy
            ;;
        2)
            print_status "Creating production deployment..."
            vercel deploy --prod
            ;;
        *)
            print_error "Invalid choice. Defaulting to preview deployment..."
            vercel deploy
            ;;
    esac
    
    print_success "Deployment completed!"
}

# Set up environment variables
setup_environment_variables() {
    print_status "Setting up environment variables..."
    
    echo -e "${YELLOW}Do you want to set up environment variables now? (y/n)${NC}"
    read -p "Choice: " setup_env
    
    if [ "$setup_env" = "y" ] || [ "$setup_env" = "Y" ]; then
        print_status "Setting up environment variables..."
        print_warning "Please have your values ready for:"
        echo "- Supabase URL and keys"
        echo "- Resend API key"
        echo "- OpenAI API key"
        echo "- Meta access token"
        echo "- Sentry DSN (optional)"
        
        echo -e "${BLUE}Press Enter to continue...${NC}"
        read
        
        # Set common environment variables
        vercel env add NODE_ENV production production
        vercel env add NEXT_PUBLIC_ENVIRONMENT production production
        
        echo -e "${BLUE}Please set the remaining environment variables manually in the Vercel dashboard${NC}"
        echo "Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables"
    else
        print_warning "Environment variables setup skipped. Remember to set them up in the Vercel dashboard!"
    fi
}

# Verify cron jobs
verify_cron_jobs() {
    print_status "Verifying cron job configuration..."
    
    if [ -f "vercel.json" ]; then
        cron_count=$(grep -c '"path":' vercel.json)
        print_success "Found $cron_count cron jobs configured in vercel.json"
        
        echo -e "${BLUE}Cron jobs will be automatically enabled on Vercel Pro plans${NC}"
        echo "Monitor them at: https://vercel.com/dashboard → Your Project → Functions → Crons"
    else
        print_error "vercel.json not found - cron jobs won't be configured"
    fi
}

# Show deployment summary
show_summary() {
    print_success "🎉 Deployment process completed!"
    
    echo -e "${BLUE}📋 Summary:${NC}"
    echo "✅ Application deployed to Vercel"
    echo "✅ Cron jobs configured (11 jobs)"
    echo "✅ Build process completed"
    
    echo -e "${BLUE}📅 Configured Cron Jobs:${NC}"
    echo "• Monthly Collection: Sunday 23:00"
    echo "• Weekly Collection: Daily 00:01"
    echo "• Background Cleanup: Saturday 02:00"
    echo "• Executive Summaries Cleanup: Saturday 03:00"
    echo "• Send Scheduled Reports: Daily 09:00"
    echo "• Current Month Cache Refresh: Every 3 hours"
    echo "• Current Week Cache Refresh: Every 3 hours (offset)"
    echo "• Archive Completed Months: 1st of month 01:00"
    echo "• Archive Completed Weeks: Monday 02:00"
    echo "• Monthly Cleanup: 1st of month 04:00"
    echo "• Daily KPI Collection: Daily 01:00"
    
    echo -e "${BLUE}🔧 Next Steps:${NC}"
    echo "1. Set up environment variables in Vercel dashboard"
    echo "2. Verify cron jobs are active (requires Vercel Pro plan)"
    echo "3. Test API endpoints"
    echo "4. Monitor deployment logs"
    echo "5. Set up custom domain (optional)"
    
    echo -e "${BLUE}📚 Useful Commands:${NC}"
    echo "• Check deployment: vercel ls"
    echo "• View logs: vercel logs"
    echo "• Environment variables: vercel env ls"
    echo "• Local development: vercel dev"
}

# Main execution
main() {
    echo "Meta Ads Reporting SaaS - Vercel Deployment"
    echo "==========================================="
    
    check_vercel_cli
    check_vercel_auth
    run_checks
    build_locally
    deploy_to_vercel
    setup_environment_variables
    verify_cron_jobs
    show_summary
    
    print_success "Deployment script completed successfully! 🚀"
}

# Run main function
main 