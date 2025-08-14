#!/bin/bash

# Push Environment Variables to Vercel Production (Fixed Version)
# This script reads your .env file and pushes all variables to Vercel

echo "🚀 Pushing environment variables to Vercel Production..."

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

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    exit 1
fi

print_status "Found the following variables in .env:"
grep -v '^#' .env | grep -v '^$' | cut -d'=' -f1 | sed 's/^/  - /'
echo ""

# Let's set them one by one using a simpler approach
print_status "Setting each environment variable..."

# Production App URL
PROD_URL="https://piotr-ko8vf5ara-jachonkisz-gmailcoms-projects.vercel.app"
print_status "Setting production URL: $PROD_URL"

# Create a temporary script to set all variables
cat > /tmp/set_env_vars.sh << 'EOF'
#!/bin/bash

# Read .env and set variables
source .env

# Set environment variables one by one
echo "Setting Supabase variables..."
echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production  
echo "$SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo "Setting API keys..."
echo "$RESEND_API_KEY" | vercel env add RESEND_API_KEY production
echo "$OPENAI_API_KEY" | vercel env add OPENAI_API_KEY production

echo "Setting Meta API variables..."
echo "$META_APP_ID" | vercel env add META_APP_ID production
echo "$META_APP_SECRET" | vercel env add META_APP_SECRET production

echo "Setting application variables..."
echo "https://piotr-ko8vf5ara-jachonkisz-gmailcoms-projects.vercel.app" | vercel env add NEXT_PUBLIC_APP_URL production
echo "production" | vercel env add NODE_ENV production
echo "production" | vercel env add NEXT_PUBLIC_ENVIRONMENT production
echo "info" | vercel env add LOG_LEVEL production

echo "Environment variables set!"
EOF

chmod +x /tmp/set_env_vars.sh

print_status "Executing environment setup..."
/tmp/set_env_vars.sh

# Clean up
rm /tmp/set_env_vars.sh

print_success "🎉 Environment variables setup completed!"
print_warning "⚠️  Checking what was set..."

vercel env ls

print_warning "⚠️  To apply changes, redeploy with:"
echo "   vercel --prod" 