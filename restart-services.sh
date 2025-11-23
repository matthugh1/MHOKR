#!/bin/bash

# Restart all OKR Framework services
# This script stops all services and attempts to start them again

set -e

cd "$(dirname "$0")"

echo "🛑 Stopping all services..."
docker-compose down

echo ""
echo "🚀 Starting all services..."
docker-compose up -d

echo ""
echo "✅ Services restart initiated. Checking status..."
sleep 3
docker-compose ps

echo ""
echo "📋 To view logs, run: docker-compose logs -f"
echo "📋 To view specific service logs, run: docker-compose logs -f <service-name>"









