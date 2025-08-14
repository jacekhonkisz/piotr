#!/bin/bash

# Fix Supabase Authentication Issue Script
echo "🔧 Fixing Supabase Auth Issue..."
echo "=================================="

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

echo "Problem: AuthApiError: Invalid API key"
echo ""
print_warning "Please check your Supabase dashboard first:"
echo "1. Go to: https://supabase.com/dashboard"
echo "2. Check if project 'xbklptrrfdspyvnjaojf' is active"
echo "3. Go to Settings → API and copy the current keys"
echo ""

print_status "Current keys in local .env:"
cat .env | grep SUPABASE
echo ""

print_warning "Do you have NEW keys from Supabase Dashboard? (y/n)"
read -p "Choice: " have_new_keys

if [ "$have_new_keys" != "y" ] && [ "$have_new_keys" != "Y" ]; then
    print_error "Please get the NEW keys from Supabase Dashboard first!"
    echo "1. Go to https://supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Go to Settings → API"
    echo "4. Copy: Project URL, anon public key, service_role secret key"
    echo "5. Run this script again"
    exit 1
fi

print_status "Please paste the NEW keys from Supabase Dashboard:"
echo ""

read -p "New SUPABASE_URL: " NEW_URL
if [ -z "$NEW_URL" ]; then
    print_error "URL cannot be empty!"
    exit 1
fi

read -p "New ANON_KEY: " NEW_ANON_KEY
if [ -z "$NEW_ANON_KEY" ]; then
    print_error "ANON_KEY cannot be empty!"
    exit 1
fi

read -p "New SERVICE_KEY: " NEW_SERVICE_KEY
if [ -z "$NEW_SERVICE_KEY" ]; then
    print_error "SERVICE_KEY cannot be empty!"
    exit 1
fi

print_status "Removing old environment variables..."
vercel env rm NEXT_PUBLIC_SUPABASE_URL production
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production  
vercel env rm SUPABASE_SERVICE_ROLE_KEY production

print_status "Adding new environment variables..."
echo "$NEW_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "$NEW_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "$NEW_SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

print_success "Environment variables updated!"

print_status "Updating local .env file..."
sed -i.backup "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$NEW_URL|" .env
sed -i.backup "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEW_ANON_KEY|" .env  
sed -i.backup "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$NEW_SERVICE_KEY|" .env

print_success "Local .env file updated!"

print_status "Redeploying to Vercel..."
vercel --prod

print_success "🎉 Fixed! Your Supabase authentication should work now."
print_warning "Wait 2-3 minutes for deployment to complete, then test your app."

echo ""
print_status "Next steps:"
echo "1. Wait for deployment to finish"
echo "2. Test login at your app URL"
echo "3. Check if user 'admin@example.com' exists in Supabase Dashboard → Authentication → Users"
echo "4. If user doesn't exist, create one or change the email in your app"

print_success "Authentication fix completed! 🚀" 