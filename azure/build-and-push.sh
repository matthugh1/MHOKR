#!/bin/bash
# Build and Push Docker Images to Azure Container Registry

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

echo -e "${GREEN}=== Building and Pushing Docker Images ===${NC}"

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

# Build and push images
SERVICES=("api-gateway" "core-api" "ai-service" "integration-service")
WEB_APP="web"

# Build and push service images
for SERVICE in "${SERVICES[@]}"; do
    echo -e "\n${YELLOW}Building $SERVICE...${NC}"
    IMAGE_NAME="$ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-${SERVICE}:latest"
    
    docker build \
        --platform linux/amd64 \
        -f "services/$SERVICE/Dockerfile" \
        -t "$IMAGE_NAME" \
        .
    
    echo -e "${YELLOW}Pushing $SERVICE...${NC}"
    docker push "$IMAGE_NAME"
    echo -e "${GREEN}$SERVICE image pushed successfully.${NC}"
done

# Build and push web app
# NEXT_PUBLIC_API_URL is optional - if not provided, web app will use default localhost:3001
# This allows building web app before API Gateway is deployed (for initial build)
# Then rebuild with API Gateway URL after deployment
echo -e "\n${YELLOW}Building web app...${NC}"
WEB_IMAGE_NAME="$ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-web:latest"

BUILD_ARGS=""
if [ -n "$NEXT_PUBLIC_API_URL" ]; then
    BUILD_ARGS="--build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
    echo -e "${YELLOW}Building with NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL${NC}"
fi

docker build \
    --platform linux/amd64 \
    -f "apps/web/Dockerfile" \
    -t "$WEB_IMAGE_NAME" \
    $BUILD_ARGS \
    .

echo -e "${YELLOW}Pushing web app...${NC}"
docker push "$WEB_IMAGE_NAME"
echo -e "${GREEN}Web app image pushed successfully.${NC}"

# Output summary
echo -e "\n${GREEN}=== Build Summary ===${NC}"
for SERVICE in "${SERVICES[@]}"; do
    echo -e "${GREEN}✓${NC} $SERVICE: $ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-${SERVICE}:latest"
done
echo -e "${GREEN}✓${NC} web: $ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-web:latest"
echo -e "\n${GREEN}All images built and pushed successfully!${NC}"

