#!/bin/bash

# Vercel Environment Variables Setup Script
# This script helps set up all required environment variables for Vercel deployment

echo "🔧 Setting up Vercel Environment Variables"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    print_warning "Not logged in to Vercel. Please login first..."
    vercel login
fi

print_status "Setting up environment variables for all environments..."

# Required environment variables
env_vars=(
    "NODE_ENV"
    "NEXT_PUBLIC_ENVIRONMENT"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "RESEND_API_KEY"
    "NEXT_PUBLIC_APP_URL"
    "OPENAI_API_KEY"
    "META_ACCESS_TOKEN"
    "LOG_LEVEL"
)

# Optional environment variables
optional_vars=(
    "SENTRY_DSN"
    "NEXT_PUBLIC_SENTRY_DSN"
)

echo -e "${BLUE}This script will help you set up the following required environment variables:${NC}"
for var in "${env_vars[@]}"; do
    echo "• $var"
done

echo -e "\n${BLUE}And these optional variables:${NC}"
for var in "${optional_vars[@]}"; do
    echo "• $var"
done

echo -e "\n${YELLOW}Do you want to proceed? (y/n)${NC}"
read -p "Choice: " proceed

if [ "$proceed" != "y" ] && [ "$proceed" != "Y" ]; then
    echo "Setup cancelled."
    exit 0
fi

# Function to add environment variable
add_env_var() {
    local var_name=$1
    local is_optional=${2:-false}
    
    echo -e "\n${BLUE}Setting up: $var_name${NC}"
    
    if [ "$is_optional" = true ]; then
        echo -e "${YELLOW}This variable is optional. Skip? (y/n)${NC}"
        read -p "Skip $var_name: " skip
        if [ "$skip" = "y" ] || [ "$skip" = "Y" ]; then
            print_warning "Skipped $var_name"
            return
        fi
    fi
    
    # Special handling for some variables
    case $var_name in
        "NODE_ENV")
            echo "Setting NODE_ENV to 'production' for production environment"
            vercel env add NODE_ENV production production
            ;;
        "NEXT_PUBLIC_ENVIRONMENT")
            echo "Setting NEXT_PUBLIC_ENVIRONMENT to 'production' for production environment"
            vercel env add NEXT_PUBLIC_ENVIRONMENT production production
            ;;
        "LOG_LEVEL")
            echo "Setting LOG_LEVEL to 'info' for production environment"
            vercel env add LOG_LEVEL info production
            ;;
        *)
            echo "Please enter the value for $var_name:"
            read -p "Value: " var_value
            if [ -n "$var_value" ]; then
                vercel env add "$var_name" "$var_value" production
                print_success "Added $var_name"
            else
                print_warning "Skipped $var_name (empty value)"
            fi
            ;;
    esac
}

# Set up required environment variables
print_status "Setting up required environment variables..."
for var in "${env_vars[@]}"; do
    add_env_var "$var"
done

# Set up optional environment variables
print_status "Setting up optional environment variables..."
for var in "${optional_vars[@]}"; do
    add_env_var "$var" true
done

# Show current environment variables
echo -e "\n${BLUE}Current environment variables:${NC}"
vercel env ls

print_success "Environment variables setup completed!"

echo -e "\n${BLUE}📋 Summary of what was configured:${NC}"
echo "✅ Production environment variables set"
echo "✅ Application ready for deployment"

echo -e "\n${BLUE}🔧 Next Steps:${NC}"
echo "1. Deploy your application: ./scripts/deploy-to-vercel.sh"
echo "2. Verify deployment in Vercel dashboard"
echo "3. Test your API endpoints"
echo "4. Monitor cron job execution"

echo -e "\n${BLUE}📚 Useful Commands:${NC}"
echo "• Check env vars: vercel env ls"
echo "• Remove env var: vercel env rm VARIABLE_NAME"
echo "• Deploy app: vercel --prod" 