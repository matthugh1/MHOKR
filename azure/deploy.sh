#!/bin/bash
# Main Azure Deployment Script
# Orchestrates the deployment of all services to Azure Container Apps

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     OKR Nexus - Azure Container Apps Deployment        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo -e "${RED}Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if logged in
if ! az account show &>/dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Please run: az login${NC}"
    exit 1
fi

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)

# Step 1: Infrastructure
echo -e "\n${BLUE}Step 1: Provisioning Infrastructure...${NC}"
bash "$SCRIPT_DIR/infrastructure.sh"

# Step 2: Build and Push Images
echo -e "\n${BLUE}Step 2: Building and Pushing Docker Images...${NC}"
bash "$SCRIPT_DIR/build-and-push.sh"

# Step 3: Deploy Infrastructure Services (PostgreSQL, Redis)
echo -e "\n${BLUE}Step 3: Deploying Infrastructure Services...${NC}"
bash "$SCRIPT_DIR/deploy-infrastructure.sh"

# Step 4: Deploy Application Services
echo -e "\n${BLUE}Step 4: Deploying Application Services...${NC}"
bash "$SCRIPT_DIR/deploy-services.sh"

# Step 5: Get URLs
echo -e "\n${BLUE}Step 5: Retrieving Service URLs...${NC}"

API_GATEWAY_URL=$(az containerapp show \
    --name "${APP_NAME_PREFIX}-api-gateway" \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || echo "")

WEB_APP_URL=$(az containerapp show \
    --name "${APP_NAME_PREFIX}-web" \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || echo "")

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Deployment Complete!                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

if [ -n "$API_GATEWAY_URL" ]; then
    echo -e "${GREEN}API Gateway URL:${NC} https://$API_GATEWAY_URL"
fi

if [ -n "$WEB_APP_URL" ]; then
    echo -e "${GREEN}Web App URL:${NC} https://$WEB_APP_URL"
fi

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. Update your .env file with the service URLs above"
echo -e "2. Run database migrations: npm run db:migrate"
echo -e "3. Verify services are running: az containerapp list --resource-group $RESOURCE_GROUP"
echo -e "\n${GREEN}Deployment completed successfully!${NC}"




