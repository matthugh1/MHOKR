#!/bin/bash
# Run Prisma migrations against Azure PostgreSQL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Running database migrations...${NC}"

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL is not set in .env${NC}"
    exit 1
fi

cd "$PROJECT_ROOT/services/core-api"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci --legacy-peer-deps
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run migrations
echo -e "${YELLOW}Deploying migrations to Azure PostgreSQL...${NC}"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

echo -e "${GREEN}✓ Migrations completed successfully!${NC}"

# Optional: Seed database
if [ "$1" = "--seed" ]; then
    echo -e "\n${YELLOW}Seeding database...${NC}"
    DATABASE_URL="$DATABASE_URL" npm run prisma:seed
    echo -e "${GREEN}✓ Database seeded!${NC}"
fi

echo ""
echo -e "${YELLOW}To seed the database, run:${NC}"
echo "  $0 --seed"




