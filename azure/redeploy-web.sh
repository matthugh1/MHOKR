#!/bin/bash
# Redeploy Web App to Azure Container Apps
# This script rebuilds and redeploys only the web app with the latest code changes

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
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        OKR Nexus - Web App Redeployment                 ║${NC}"
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
echo -e "${GREEN}ACR Login Server: $ACR_LOGIN_SERVER${NC}"

# Get API Gateway URL
echo -e "\n${YELLOW}Retrieving API Gateway URL...${NC}"
API_GATEWAY_URL=$(az containerapp show \
    --name "${APP_NAME_PREFIX}-api-gateway" \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || echo "")

if [ -z "$API_GATEWAY_URL" ]; then
    echo -e "${RED}Error: Could not retrieve API Gateway URL. Is the API Gateway deployed?${NC}"
    exit 1
fi

echo -e "${GREEN}API Gateway URL: https://$API_GATEWAY_URL${NC}"

# Login to ACR
echo -e "\n${YELLOW}Logging in to Azure Container Registry...${NC}"
az acr login --name "$ACR_NAME"

# Change to project root
cd "$PROJECT_ROOT"

# Build and push web app
echo -e "\n${YELLOW}Building web app with NEXT_PUBLIC_API_URL=https://$API_GATEWAY_URL...${NC}"
WEB_IMAGE_NAME="$ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-web:latest"

docker build \
    --platform linux/amd64 \
    -f "apps/web/Dockerfile" \
    --build-arg NEXT_PUBLIC_API_URL="https://$API_GATEWAY_URL" \
    -t "$WEB_IMAGE_NAME" \
    .

echo -e "\n${YELLOW}Pushing web app image to ACR...${NC}"
docker push "$WEB_IMAGE_NAME"
echo -e "${GREEN}Web app image pushed successfully.${NC}"

# Update Container App
echo -e "\n${YELLOW}Updating Container App...${NC}"
WEB_APP_URL=$(az containerapp update \
    --name "${APP_NAME_PREFIX}-web" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$WEB_IMAGE_NAME" \
    --env-vars \
        NODE_ENV=production \
        NEXT_PUBLIC_API_URL="https://$API_GATEWAY_URL" \
        NEXTAUTH_URL="${NEXTAUTH_URL:-https://$API_GATEWAY_URL}" \
        NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    --query properties.configuration.ingress.fqdn -o tsv)

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Web App Redeployment Complete!                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}Web App URL:${NC} https://$WEB_APP_URL"
echo -e "${GREEN}API Gateway URL:${NC} https://$API_GATEWAY_URL"
echo -e "\n${YELLOW}Note:${NC} It may take a few minutes for the new deployment to be available."
echo -e "${YELLOW}You can check the deployment status with:${NC}"
echo -e "  az containerapp show --name ${APP_NAME_PREFIX}-web --resource-group $RESOURCE_GROUP --query properties.latestRevisionName -o tsv"

