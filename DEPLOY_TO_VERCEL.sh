#!/bin/bash

# Vercel Deployment Script for Google RMF Audit
# Date: January 27, 2025

echo "🚀 Piotr - Vercel Deployment Script"
echo "===================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found!"
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
else
    echo "✅ Vercel CLI found"
fi

echo ""
echo "📋 Pre-deployment checklist:"
echo "  [1] Build passes locally"
echo "  [2] All RMF features implemented"
echo "  [3] Environment variables ready"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🔨 Testing build locally..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Fix errors before deploying."
    exit 1
fi

echo "✅ Local build successful"
echo ""

echo "🚀 Deploying to Vercel..."
echo ""
echo "Choose deployment type:"
echo "  1) Preview (test deployment)"
echo "  2) Production (live deployment)"
echo ""

read -p "Enter choice (1 or 2): " deployment_type

if [ "$deployment_type" = "1" ]; then
    echo ""
    echo "📤 Deploying preview..."
    vercel
elif [ "$deployment_type" = "2" ]; then
    echo ""
    echo "📤 Deploying to production..."
    vercel --prod
else
    echo "❌ Invalid choice"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Add environment variables in Vercel Dashboard"
echo "  2. Redeploy: vercel --prod"
echo "  3. Test your live site"
echo "  4. Take screenshots for Google"
echo "  5. Update GOOGLE_RMF_AUDIT_RESPONSE.md with live URL"
echo ""
echo "🎯 Good luck with your RMF audit!"
