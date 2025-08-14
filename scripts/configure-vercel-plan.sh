#!/bin/bash

# Vercel Plan Configuration Script
# This script configures the appropriate vercel.json based on your Vercel plan

echo "🔧 Vercel Plan Configuration"
echo "============================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

echo -e "${BLUE}Which Vercel plan are you using?${NC}"
echo "1) Hobby Plan (Free) - Daily cron jobs only"
echo "2) Pro Plan ($20/month) - Frequent cron jobs (every 3 hours)"
echo "3) Enterprise Plan - Full cron job support"
echo ""
read -p "Enter your plan choice (1, 2, or 3): " plan_choice

case $plan_choice in
    1)
        print_status "Configuring for Hobby Plan..."
        echo -e "${YELLOW}Hobby plan is limited to 2 cron jobs. Choose configuration:${NC}"
        echo "1) Minimal (2 jobs) - Weekly Collection + Scheduled Reports"
        echo "2) Standard (11 jobs) - All automation features"
        read -p "Enter choice (1 or 2): " hobby_choice
        
        if [ "$hobby_choice" = "1" ]; then
            if [ -f "vercel-hobby-minimal.json" ]; then
                cp vercel-hobby-minimal.json vercel.json
                print_success "Configured vercel.json for Hobby Plan (Minimal)"
                echo ""
                echo -e "${BLUE}📅 Cron Jobs Schedule (Hobby Minimal):${NC}"
                echo "• Weekly Collection: Daily 00:01"
                echo "• Send Scheduled Reports: Daily 09:00"
                echo ""
                print_warning "Limited automation: Only essential data collection and reports"
                print_warning "Manual operations required for cleanup and monthly collection"
            else
                print_error "vercel-hobby-minimal.json not found"
                exit 1
            fi
        else
            if [ -f "vercel-hobby.json" ]; then
                cp vercel-hobby.json vercel.json
                print_success "Configured vercel.json for Hobby Plan (Standard)"
                echo ""
                print_error "❌ This configuration has 11 cron jobs but Hobby plan only allows 2"
                print_warning "Deployment will fail. Please upgrade to Pro plan or use minimal configuration"
                echo ""
                echo -e "${BLUE}📅 Full Cron Jobs Schedule:${NC}"
                echo "• Monthly Collection: Sunday 23:00"
                echo "• Weekly Collection: Daily 00:01"
                echo "• Background Cleanup: Saturday 02:00"
                echo "• Executive Summaries Cleanup: Saturday 03:00"
                echo "• Send Scheduled Reports: Daily 09:00"
                echo "• Current Month Cache Refresh: Daily 06:00"
                echo "• Current Week Cache Refresh: Daily 12:00"
                echo "• Archive Completed Months: 1st of month 01:00"
                echo "• Archive Completed Weeks: Monday 02:00"
                echo "• Monthly Cleanup: 1st of month 04:00"
                echo "• Daily KPI Collection: Daily 01:00"
            else
                print_error "vercel-hobby.json not found"
                exit 1
            fi
        fi
        ;;
    2|3)
        print_status "Configuring for Pro/Enterprise Plan..."
        if [ -f "vercel-pro.json" ]; then
            cp vercel-pro.json vercel.json
            print_success "Configured vercel.json for Pro/Enterprise Plan"
            echo ""
            echo -e "${BLUE}📅 Cron Jobs Schedule (Pro/Enterprise Plan):${NC}"
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
            echo ""
            print_success "Full cron job frequency enabled"
        else
            print_error "vercel-pro.json not found"
            exit 1
        fi
        ;;
    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

# Show current vercel.json content
echo -e "${BLUE}📋 Current vercel.json configuration:${NC}"
cat vercel.json | grep -A 5 -B 5 schedule | head -20

echo ""
print_success "Vercel configuration updated successfully!"

echo -e "${BLUE}🔧 Next Steps:${NC}"
echo "1. Deploy to Vercel: vercel --prod"
echo "2. Check cron jobs in Vercel dashboard"
echo "3. Monitor logs for successful execution"

if [ "$plan_choice" = "1" ]; then
    echo ""
    print_warning "Hobby Plan Limitations:"
    echo "• Cron jobs run only once per day"
    echo "• Less frequent data updates"
    echo "• Consider upgrading to Pro for better performance"
fi 