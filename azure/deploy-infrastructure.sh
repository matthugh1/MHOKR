#!/bin/bash
# Deploy Infrastructure Services (PostgreSQL and Redis) to Azure Container Apps

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
NC='\033[0m' # No Color

echo -e "${GREEN}=== Deploying Infrastructure Services ===${NC}"

# Deploy PostgreSQL
echo -e "${YELLOW}Deploying PostgreSQL container...${NC}"
az containerapp create \
    --name "${APP_NAME_PREFIX}-postgres" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image docker.io/library/postgres:16-alpine \
    --min-replicas 1 \
    --max-replicas 1 \
    --cpu 1.0 \
    --memory 2.0Gi \
    --env-vars \
        POSTGRES_USER="$POSTGRES_USER" \
        POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        POSTGRES_DB="$POSTGRES_DB" \
    --ingress internal \
    --target-port 5432 \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-postgres" \
    --resource-group "$RESOURCE_GROUP" \
    --image postgres:16-alpine \
    --env-vars \
        POSTGRES_USER="$POSTGRES_USER" \
        POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        POSTGRES_DB="$POSTGRES_DB" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null

echo -e "${GREEN}PostgreSQL deployed successfully.${NC}"

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
sleep 10

# Deploy Redis
echo -e "${YELLOW}Deploying Redis container...${NC}"
az containerapp create \
    --name "${APP_NAME_PREFIX}-redis" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image docker.io/library/redis:7-alpine \
    --min-replicas 1 \
    --max-replicas 1 \
    --cpu 0.5 \
    --memory 1.0Gi \
    --command "redis-server --appendonly yes" \
    --ingress internal \
    --target-port 6379 \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-redis" \
    --resource-group "$RESOURCE_GROUP" \
    --image redis:7-alpine \
    --command "redis-server --appendonly yes" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null

echo -e "${GREEN}Redis deployed successfully.${NC}"

# Get internal DNS names
POSTGRES_HOST="${APP_NAME_PREFIX}-postgres"
REDIS_HOST="${APP_NAME_PREFIX}-redis"

echo -e "\n${GREEN}=== Infrastructure Services Deployed ===${NC}"
echo -e "PostgreSQL Host: ${GREEN}$POSTGRES_HOST${NC}"
echo -e "Redis Host: ${GREEN}$REDIS_HOST${NC}"
echo -e "\n${YELLOW}Note: These services use internal DNS resolution within the Container Apps Environment.${NC}"

