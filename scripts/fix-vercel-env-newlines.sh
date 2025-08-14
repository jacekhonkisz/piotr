#!/bin/bash

# Fix Vercel Environment Variables Newline Issue
echo "🔧 Fixing Vercel Environment Variables Newlines..."
echo "================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

print_warning "Problem identified: Environment variables have newline characters (\n)"
print_status "This causes Supabase API keys to be invalid"
echo ""

print_status "Step 1: Removing all environment variables..."

# Remove all environment variables
env_vars=(
    "NODE_ENV"
    "NEXT_PUBLIC_ENVIRONMENT"
    "NEXT_PUBLIC_APP_URL"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "RESEND_API_KEY"
    "OPENAI_API_KEY"
    "META_APP_ID"
    "META_APP_SECRET"
    "LOG_LEVEL"
)

for var in "${env_vars[@]}"; do
    print_status "Removing $var..."
    vercel env rm "$var" production --yes 2>/dev/null || true
done

print_success "All environment variables removed"
echo ""

print_status "Step 2: Re-adding variables from local .env (without newlines)..."

# Read local .env and add variables properly
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    if [[ -z "$key" || "$key" =~ ^#.* ]]; then
        continue
    fi
    
    # Remove any quotes from value
    value="${value%\"}"
    value="${value#\"}"
    
    print_status "Adding $key..."
    echo "$value" | vercel env add "$key" production
done < .env

print_success "All environment variables re-added without newlines!"
echo ""
print_status "Next: Redeploy with 'vercel --prod'" 