#!/bin/bash
# Test production build locally to match Azure deployment structure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🧪 Testing production build structure locally..."
echo ""

cd "$WEB_DIR"

# Set production API URL
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://okr-nexus-api-gateway.azurewebsites.net}"

# Build the app
echo "📦 Building Next.js app..."
npm run build

# Create the same structure as Azure deployment
echo ""
echo "📁 Creating production deployment structure..."
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"

# Copy standalone build
cp -r .next/standalone/* "$TEST_DIR/"

# Copy static files to root .next/static/ (where Next.js standalone expects them)
if [ -d ".next/static" ]; then
  mkdir -p "$TEST_DIR/.next/static"
  cp -r .next/static/* "$TEST_DIR/.next/static/"
  echo "✓ Copied static files to root .next/static/"
  
  # Also copy to apps/web/.next/static/ (backup)
  mkdir -p "$TEST_DIR/apps/web/.next/static"
  cp -r .next/static/* "$TEST_DIR/apps/web/.next/static/"
  echo "✓ Copied static files to apps/web/.next/static/ (backup)"
else
  echo "⚠ Warning: .next/static directory not found"
fi

# Copy public directory
if [ -d "public" ]; then
  mkdir -p "$TEST_DIR/apps/web/public"
  cp -r public/* "$TEST_DIR/apps/web/public/" 2>/dev/null || true
  echo "✓ Copied public files"
fi

# Verify structure
echo ""
echo "🔍 Verifying structure..."
echo "Server.js location:"
find "$TEST_DIR" -name "server.js" -type f | head -3
echo ""
echo "Static files location:"
find "$TEST_DIR" -path "*/static/chunks/*" -type f | head -5 || echo "No static chunks found!"
echo ""
echo "Directory structure:"
ls -la "$TEST_DIR" | head -10
echo ""

# Start the server
echo "🚀 Starting server (matching Azure: node apps/web/server.js)..."
echo "Server will run on http://localhost:5173"
echo "Press Ctrl+C to stop"
echo ""

cd "$TEST_DIR"
PORT=5173 node apps/web/server.js

