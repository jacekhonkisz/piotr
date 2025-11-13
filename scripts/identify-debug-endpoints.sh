#!/bin/bash

# Script to identify debug and test endpoints that should be removed from production
# Usage: ./scripts/identify-debug-endpoints.sh

echo "🔍 Identifying Debug and Test Endpoints..."
echo "=========================================="
echo ""

# Find all debug endpoints
echo "📋 DEBUG ENDPOINTS:"
find src/app/api -type d -name "debug*" | while read dir; do
    echo "  - $dir"
done

echo ""
echo "📋 TEST ENDPOINTS:"
find src/app/api -type d -name "test*" | while read dir; do
    echo "  - $dir"
done

echo ""
echo "📋 INDIVIDUAL DEBUG/TEST FILES:"
find src/app/api -type f -name "*debug*" -o -name "*test*" | grep -E "(debug|test)" | while read file; do
    echo "  - $file"
done

echo ""
echo "📋 ENDPOINTS TO REMOVE (for production):"
echo ""
echo "  # Debug endpoints"
find src/app/api -type d -name "debug*" -exec echo "  rm -rf {}" \;
echo ""
echo "  # Test endpoints"
find src/app/api -type d -name "test*" -exec echo "  rm -rf {}" \;
echo ""
echo "  # Individual files"
find src/app/api -type f \( -name "*debug*" -o -name "*test*" -o -name "simple" -o -name "ping" \) | grep -v "node_modules" | while read file; do
    echo "  rm -f $file"
done

echo ""
echo "✅ Analysis complete!"
echo ""
echo "⚠️  WARNING: Review the list above before removing any endpoints."
echo "   Some endpoints may be needed for monitoring or health checks."



