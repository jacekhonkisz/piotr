#!/bin/bash

# Push Environment Variables to Vercel Production
# This script reads your .env file and pushes all variables to Vercel

echo "🚀 Pushing environment variables to Vercel Production..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

print_status "Reading environment variables from .env file..."

# Read .env file and push each variable
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Extract variable name and value
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_value="${BASH_REMATCH[2]}"
        
        # Remove quotes if present
        var_value=$(echo "$var_value" | sed 's/^"//;s/"$//')
        
        print_status "Setting $var_name..."
        
        # Push to Vercel (production environment)
        echo "$var_value" | vercel env add "$var_name" production --yes
        
        if [ $? -eq 0 ]; then
            print_success "✅ $var_name set successfully"
        else
            print_warning "⚠️  Failed to set $var_name"
        fi
        
        # Small delay to avoid rate limiting
        sleep 1
    fi
done < .env

# Add production-specific variables
print_status "Adding production-specific variables..."

# Update app URL for production
PROD_URL="https://piotr-ko8vf5ara-jachonkisz-gmailcoms-projects.vercel.app"
echo "$PROD_URL" | vercel env add NEXT_PUBLIC_APP_URL production --yes
print_success "✅ Updated NEXT_PUBLIC_APP_URL for production"

# Set production environment
echo "production" | vercel env add NODE_ENV production --yes
print_success "✅ Set NODE_ENV to production"

echo "production" | vercel env add NEXT_PUBLIC_ENVIRONMENT production --yes
print_success "✅ Set NEXT_PUBLIC_ENVIRONMENT to production"

echo "info" | vercel env add LOG_LEVEL production --yes
print_success "✅ Set LOG_LEVEL to info"

echo ""
print_success "🎉 All environment variables pushed to Vercel!"
print_warning "⚠️  Remember to redeploy for changes to take effect:"
echo "   vercel --prod"

echo ""
print_status "📋 Environment variables that were set:"
vercel env ls 