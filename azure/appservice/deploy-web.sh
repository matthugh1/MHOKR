#!/bin/bash
# Deploy Next.js web app to Azure App Service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env"

BUILD_DIR="$SCRIPT_DIR/build"
APP_SERVICE_PLAN_NAME="${APP_SERVICE_PLAN_NAME:-${APP_NAME_PREFIX}-plan}"
APP_NAME="${APP_NAME_PREFIX}-web"
ZIP_FILE="$BUILD_DIR/web.zip"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Deploying Next.js web app...${NC}"

if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}Error: Build artifact not found: $ZIP_FILE${NC}"
    echo -e "${YELLOW}Run build-services.sh first${NC}"
    exit 1
fi

# Create web app if it doesn't exist
if ! az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "  Creating web app: $APP_NAME"
    az webapp create \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --plan "$APP_SERVICE_PLAN_NAME" \
        --runtime "NODE:20-lts"
else
    echo "  Web app exists: $APP_NAME"
fi

# Get API Gateway URL for runtime config
API_GATEWAY_URL=$(az webapp show \
    --name "${APP_NAME_PREFIX}-api-gateway" \
    --resource-group "$RESOURCE_GROUP" \
    --query defaultHostName -o tsv 2>/dev/null || echo "")

if [ -n "$API_GATEWAY_URL" ]; then
    NEXT_PUBLIC_API_URL="https://${API_GATEWAY_URL}"
else
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://${APP_NAME_PREFIX}-api-gateway.azurewebsites.net}"
fi

# Configure app settings
echo "  Configuring app settings..."
az webapp config appsettings set \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        WEBSITES_PORT="5173" \
        PORT="5173" \
        NODE_ENV="production" \
        HOSTNAME="0.0.0.0" \
        NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
        SCM_DO_BUILD_DURING_DEPLOYMENT="false" \
    --output none

# Set startup command
echo "  Setting startup command..."
az webapp config set \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --startup-file "node apps/web/server.js" \
    --output none

# Enable logging
az webapp log config \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --application-logging filesystem \
    --detailed-error-messages true \
    --failed-request-tracing true \
    --web-server-logging filesystem \
    --output none

# Deploy ZIP package
echo "  Deploying application..."
az webapp deploy \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --src-path "$ZIP_FILE" \
    --type zip \
    --async false \
    --timeout 1800

# Get URL
URL=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)

echo -e "\n${GREEN}✓ Web app deployed successfully!${NC}"
echo -e "${GREEN}  URL: https://${URL}${NC}"
echo -e "${GREEN}  API: ${NEXT_PUBLIC_API_URL}${NC}"






