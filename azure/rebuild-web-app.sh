#!/bin/bash
# Rebuild and Push Web App with API Gateway URL
# This script rebuilds the web app after API Gateway is deployed
# Usage: ./rebuild-web-app.sh <api-gateway-url>

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

# Get API Gateway URL from argument or environment
API_GATEWAY_URL="${1:-$NEXT_PUBLIC_API_URL}"

if [ -z "$API_GATEWAY_URL" ]; then
    echo -e "${RED}Error: API Gateway URL is required.${NC}"
    echo -e "Usage: $0 <api-gateway-url>"
    echo -e "Or set NEXT_PUBLIC_API_URL in .env file"
    exit 1
fi

# Ensure URL starts with https://
if [[ ! "$API_GATEWAY_URL" =~ ^https?:// ]]; then
    API_GATEWAY_URL="https://$API_GATEWAY_URL"
fi

echo -e "${GREEN}=== Rebuilding Web App with API Gateway URL ===${NC}"
echo -e "${YELLOW}API Gateway URL: $API_GATEWAY_URL${NC}"

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)
echo -e "${GREEN}ACR Login Server: $ACR_LOGIN_SERVER${NC}"

# Login to ACR
echo -e "${YELLOW}Logging in to Azure Container Registry...${NC}"
az acr login --name "$ACR_NAME"

# Get the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Build and push web app with API Gateway URL
echo -e "\n${YELLOW}Building web app with NEXT_PUBLIC_API_URL=$API_GATEWAY_URL...${NC}"
WEB_IMAGE_NAME="$ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-web:latest"

docker build \
    --platform linux/amd64 \
    -f "apps/web/Dockerfile" \
    --build-arg NEXT_PUBLIC_API_URL="$API_GATEWAY_URL" \
    -t "$WEB_IMAGE_NAME" \
    .

echo -e "${YELLOW}Pushing web app...${NC}"
docker push "$WEB_IMAGE_NAME"
echo -e "${GREEN}Web app image rebuilt and pushed successfully.${NC}"

echo -e "\n${GREEN}=== Rebuild Summary ===${NC}"
echo -e "${GREEN}✓${NC} web: $ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-web:latest"
echo -e "${GREEN}✓${NC} Built with NEXT_PUBLIC_API_URL=$API_GATEWAY_URL"
echo -e "\n${YELLOW}Next step: Update the web app container to use the new image${NC}"
echo -e "Run: az containerapp update --name ${APP_NAME_PREFIX}-web --resource-group $RESOURCE_GROUP --image $WEB_IMAGE_NAME"




