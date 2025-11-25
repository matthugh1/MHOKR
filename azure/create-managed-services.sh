#!/bin/bash
# Create Azure Managed Database and Cache Services
# This replaces containerized PostgreSQL and Redis with managed services

set -e

# Load environment variables
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

source .env

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Creating Azure Managed Services                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"

# Service names
POSTGRES_SERVER_NAME="${APP_NAME_PREFIX}-postgres-db"
REDIS_NAME="${APP_NAME_PREFIX}-redis-cache"

# Create Azure Database for PostgreSQL Flexible Server
echo -e "${YELLOW}Creating Azure Database for PostgreSQL Flexible Server...${NC}"
echo -e "${YELLOW}This may take 5-10 minutes...${NC}"

az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER_NAME" \
  --location "$LOCATION" \
  --admin-user "$POSTGRES_USER" \
  --admin-password "$POSTGRES_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0-255.255.255.255 \
  --yes

echo -e "${GREEN}PostgreSQL server created successfully.${NC}"

# Create database
echo -e "${YELLOW}Creating database: $POSTGRES_DB...${NC}"
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER_NAME" \
  --database-name "$POSTGRES_DB"

echo -e "${GREEN}Database created successfully.${NC}"

# Create Azure Cache for Redis
echo -e "\n${YELLOW}Creating Azure Cache for Redis...${NC}"
echo -e "${YELLOW}This may take 10-15 minutes...${NC}"

az redis create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --location "$LOCATION" \
  --sku Basic \
  --vm-size c0 \
  --enable-non-ssl-port

echo -e "${GREEN}Redis cache created successfully.${NC}"

# Get connection strings
echo -e "\n${BLUE}Retrieving connection information...${NC}"

POSTGRES_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER_NAME" \
  --query fullyQualifiedDomainName -o tsv)

REDIS_HOST=$(az redis show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --query hostName -o tsv)

REDIS_KEY=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --query primaryKey -o tsv)

# Build connection strings
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public&sslmode=require"
REDIS_URL="redis://:${REDIS_KEY}@${REDIS_HOST}:6380?ssl=true"

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Managed Services Created!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}Connection Information:${NC}"
echo -e "${YELLOW}PostgreSQL Server:${NC} $POSTGRES_HOST"
echo -e "${YELLOW}Redis Host:${NC} $REDIS_HOST"
echo -e "\n${YELLOW}Add these to your .env file:${NC}"
echo -e "MANAGED_DATABASE_URL=\"$DATABASE_URL\""
echo -e "MANAGED_REDIS_URL=\"$REDIS_URL\""

echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. Update container app environment variables with new connection strings"
echo -e "2. Run database migrations"
echo -e "3. Delete old containerized PostgreSQL and Redis (optional)"

echo -e "\n${GREEN}Setup complete!${NC}"

