#!/bin/bash

# Production Environment Setup Script
# This script sets up the environment variables for production AI summary generation

echo "🚀 Setting up production environment for AI summary generation..."

# Set production environment variables
export NODE_ENV=production
export AI_CHEAP_MODE=false

# Optional: Set OpenAI API key if available
if [ -n "$OPENAI_API_KEY" ]; then
    echo "✅ OpenAI API key found"
else
    echo "⚠️  OpenAI API key not set - will use fallback summaries"
fi

# Optional: Set cost limits
export AI_MAX_DAILY_COST=${AI_MAX_DAILY_COST:-10.0}
export AI_MAX_MONTHLY_COST=${AI_MAX_MONTHLY_COST:-300.0}

# Optional: Set rate limits
export AI_RATE_LIMIT_PER_MINUTE=${AI_RATE_LIMIT_PER_MINUTE:-60}
export AI_RATE_LIMIT_PER_HOUR=${AI_RATE_LIMIT_PER_HOUR:-1000}
export AI_RATE_LIMIT_PER_DAY=${AI_RATE_LIMIT_PER_DAY:-10000}

echo "📊 Environment configuration:"
echo "  NODE_ENV: $NODE_ENV"
echo "  AI_CHEAP_MODE: $AI_CHEAP_MODE"
echo "  AI_MAX_DAILY_COST: $AI_MAX_DAILY_COST"
echo "  AI_MAX_MONTHLY_COST: $AI_MAX_MONTHLY_COST"
echo "  AI_RATE_LIMIT_PER_MINUTE: $AI_RATE_LIMIT_PER_MINUTE"
echo "  AI_RATE_LIMIT_PER_HOUR: $AI_RATE_LIMIT_PER_HOUR"
echo "  AI_RATE_LIMIT_PER_DAY: $AI_RATE_LIMIT_PER_DAY"

echo "✅ Production environment setup complete!"
echo ""
echo "To use this environment, run:"
echo "  source scripts/setup-production-env.sh"
echo "  npm run dev  # or npm start for production"
