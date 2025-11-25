#!/bin/bash
# Run database migrations in Azure Container Apps

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Running Database Migrations ===${NC}"

# Get the core-api container name
echo -e "${YELLOW}Connecting to core-api container...${NC}"

# Run Prisma migrations
az containerapp exec \
  --name okr-nexus-core-api \
  --resource-group vibe-code-test \
  --command "npx prisma migrate deploy"

echo -e "${GREEN}Migrations complete!${NC}"

